from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from socket_events import register_socket_events
from flask_socketio import SocketIO
import secrets
import string
from models import db, Room, UserRoom
from flask_sqlalchemy import SQLAlchemy
app = Flask(__name__)
CORS(app)

load_dotenv()

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
db.init_app(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading" 
)


register_socket_events(socketio)

with app.app_context():
    db.create_all()


def generate_room_code():
    alphabet = string.ascii_uppercase + string.digits
    
    code = ''
    for _ in range(8):
        code += ''.join(secrets.choice(alphabet))

    return code

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




if __name__ == '__main__':
    app.run(debug=True)
    socketio.run(app, debug=True)

