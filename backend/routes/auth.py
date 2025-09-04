from flask import Blueprint, request, jsonify
bp = Blueprint('auth', __name__)
@bp.post('/login')
def login():
    data = request.get_json() or {}
    email = data.get('email','pm@example.com')
    return jsonify({"id":"user-1","name":"Portfolio Manager","email":email,"role":"PM","token":"devtoken"})
