# backend/quantum/qae_pricer.py
from __future__ import annotations
import logging, numpy as np
from dataclasses import dataclass
from typing import Dict, List, Tuple
from qiskit.circuit.library import LinearAmplitudeFunction
from qiskit_finance.circuit.library import LogNormalDistribution
from qiskit_finance.applications.estimation import EuropeanCallPricing
from qiskit_algorithms import IterativeAmplitudeEstimation, EstimationProblem
from qiskit_aer.primitives import Sampler as AerSampler
from qiskit.primitives import Sampler as SamplerV1, StatevectorSampler as SamplerV2

LOG = logging.getLogger(__name__)


@dataclass(frozen=True)
class Market:
    S0: float
    r: float
    sigma: float
    T: float
    q: float = 0.0


def _make_sampler(kind: str):
    if kind == "terra":
        return SamplerV1()
    if kind == "v2":
        return SamplerV2()
    if kind == "aer":
        return AerSampler()
    raise ValueError(f"Bad sampler: {kind}")


def _bounds(m: Market, strikes: List[float]) -> Tuple[float, float]:
    from scipy.stats import lognorm

    scale = m.S0 * np.exp((m.r - m.q - 0.5 * m.sigma**2) * m.T)
    sT = m.sigma * np.sqrt(m.T)
    stat_low = lognorm.ppf(0.001, sT, scale=np.exp(np.log(scale)))
    stat_high = lognorm.ppf(0.999, sT, scale=np.exp(np.log(scale)))
    mn = min(strikes) if strikes else m.S0
    mx = max(strikes) if strikes else m.S0
    low = float(min(stat_low, mn)) - 1e-6
    high = float(max(stat_high, mx)) + 1e-6
    return (low, high)


def _uncertainty(m: Market, nq: int, bds: Tuple[float, float]):
    mu = np.log(m.S0) + (m.r - m.q - 0.5 * m.sigma**2) * m.T
    sT = m.sigma * np.sqrt(m.T)
    return LogNormalDistribution(num_qubits=nq, mu=mu, sigma=sT, bounds=bds)


def qae_price(
    m: Market,
    strikes: List[float],
    option_type: str = "CALL",
    num_qubits: int = 8,
    epsilon: float = 1e-2,
    alpha: float = 0.05,
    sampler="terra",
) -> Dict[float, float]:
    sampler_inst = _make_sampler(sampler)
    bds = _bounds(m, strikes)
    dist = _uncertainty(m, num_qubits, bds)
    iae = IterativeAmplitudeEstimation(
        epsilon_target=epsilon, alpha=alpha, sampler=sampler_inst
    )

    out: Dict[float, float] = {}
    for K in strikes:
        if option_type.upper() == "CALL":
            pricer = EuropeanCallPricing(
                num_state_qubits=num_qubits,
                strike_price=K,
                rescaling_factor=0.25,
                bounds=bds,
                uncertainty_model=dist,
            )
            problem, interpret = pricer.to_estimation_problem(), pricer.interpret
            res = iae.estimate(problem)
            undisc = float(interpret(res))
            out[K] = float(np.exp(-m.r * m.T) * max(0.0, undisc))
        else:
            # Build put via LinearAmplitudeFunction ((K - S)+)
            low, high = bds
            payoff = LinearAmplitudeFunction(
                num_state_qubits=num_qubits,
                slope=[-1, 0],
                offset=[K, 0],
                domain=(low, high),
                image=(0, K - low),
                breakpoints=[K],
            )
            from qiskit import QuantumCircuit

            qc = QuantumCircuit(payoff.num_qubits)
            qc.append(dist, range(num_qubits))
            qc.append(payoff, range(payoff.num_qubits))
            problem = EstimationProblem(
                state_preparation=qc,
                objective_qubits=[payoff.num_qubits - 1],
                post_processing=payoff.post_processing,
            )
            res = iae.estimate(problem)
            undisc = float(res.estimation_processed)
            out[K] = float(np.exp(-m.r * m.T) * max(0.0, undisc))
    return out
