from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from socket_events import register_socket_events
from flask_socketio import SocketIO
import secrets
import string
from models import db, Room, UserRoom, User
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import jwt
from flask_migrate import Migrate
app = Flask(__name__)
CORS(app)

load_dotenv()

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
db.init_app(app)
migrate = Migrate(app, db)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading" 
)


register_socket_events(socketio)

#helper functions for the rest of the app
def generate_room_code():
    alphabet = string.ascii_uppercase + string.digits
    
    code = ''
    for _ in range(8):
        code += ''.join(secrets.choice(alphabet))

    return code

def geneerate_jwt_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return token

@app.route('/create_room', methods = ['POST'])
def create_room():
    room_code = generate_room_code()

    while True:
        if not Room.query.filter_by(room_code=room_code).first():
            break

    room = Room(room_code = room_code)

    db.session.add(room)
    db.session.commit()

    return jsonify({"room_code": room_code}), 200


@app.route('/room_code_check', methods = ['POST'])
def room_code_check():
    data = request.get_json()
    room_code = data.get('room_code')

    
    room = Room.query.filter_by(room_code=room_code).first()

    if room:
        return jsonify({"exists": True}), 200
    else:
        return jsonify({"exists": False}), 200

@app.route('/auth/login', methods = ['POST'])
def login():
    data = request.get_json()
    
    provider = data.get('provider')
    provider_id = data.get('provider_id')
    email = data.get('email')

    if not provider or not provider_id or not email:
        return jsonify({"error": "Missing required fields"}), 400
    
    user = User.query.filter_by(oauth_provider=provider, oauth_id=provider_id).first()
    '''
    get the user_id. Then we want to check 
    if user even exists in our db. if not create a new user

    Then generate a jwt token and send it back to the user
    '''

    user = User.query.filter_by(oauth_provider=provider, oauth_id=provider_id).first()

    if not user:
        user = User(
            username = email.split('@')[0],
            email = email,
            oauth_provider = provider,
            oauth_id = provider_id
            
        )
        db.session.add(user)
        db.session.commit()

    token = geneerate_jwt_token(user.user_id)
    return jsonify({"token": token}), 200


if __name__ == '__main__':
    app.run(debug=True)
    socketio.run(app, debug=True)

@app.route('/get_previous_messages', methods = ['GET'])
def get_previous_messages():
    data = request.get_json()
    room_code = data.get('room_code')
    room = Room.query.filter_by(room_code = room_code).first()
    if not room:
        return jsonify({"error": "Room not found"}), 404
    
    messages = Message.query.filter_by(room_id = room.room_id).all()
    return jsonify({"messages": messages}), 200

