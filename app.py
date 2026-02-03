from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from socket_events import register_socket_events
from flask_socketio import SocketIO
import secrets
import string
from models import db, Room, UserRoom, User, Message
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import jwt
from flask_migrate import Migrate
app = Flask(__name__)
CORS(app)

load_dotenv()

# Convert postgresql:// to postgresql+psycopg:// for psycopg3
database_url = os.getenv("DATABASE_URL", "")
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
db.init_app(app)
migrate = Migrate(app, db)
# Use threading mode for better compatibility (works with Python 3.13)
# For production with Python 3.12, can switch back to eventlet
socketio = SocketIO(
    app,
    cors_allowed_origins=os.getenv("CORS_ORIGINS", "*").split(","),
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

def generate_jwt_token(user_id):
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
    
    '''
    get the user_id. Then we want to check 
    if user even exists in our db. if not create a new user

    Then generate a jwt token and send it back to the user
    '''
    user = User.query.filter_by(oauth_provider=provider, oauth_id=provider_id).first()

    if not user:
        name = data.get('name')  # Get name from request
        user = User(
            username = name if name else email.split('@')[0],
            email = email,
            oauth_provider = provider,
            oauth_id = provider_id
        )
        db.session.add(user)
        db.session.commit()

    token = generate_jwt_token(user.user_id)
    return jsonify({"token": token}), 200


@app.route('/get_previous_messages', methods = ['GET'])
def get_previous_messages():
    room_code = request.args.get('room_code')
    if not room_code:
        return jsonify({"error": "room_code parameter is required"}), 400
    
    room = Room.query.filter_by(room_code=room_code).first()
    if not room:
        return jsonify({"error": "Room not found"}), 404
    
    messages = Message.query.filter_by(room_id=room.room_id).order_by(Message.timestamp.asc()).all()
    # Convert messages to serializable format
    messages_data = [{
        "message_id": msg.message_id,
        "user_id": msg.user_id,
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat() if msg.timestamp else None
    } for msg in messages]
    
    return jsonify({"messages": messages_data}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)

