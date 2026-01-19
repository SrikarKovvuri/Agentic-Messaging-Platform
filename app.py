from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from socket_events import register_socket_events
from flask_socketio import SocketIO
import secrets
import string
from models import db, Room, UserRoom

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

register_socket_events(socketio)

def generate_room_code():
    alphabet = string.ascii_uppercase + string.digits
    
    code = ''
    for _ in range(8):
        code += ''.join(secrets.choice(alphabet))

    return code

@app.route('/create_room', methods = ['POST'])
def create_room():
    room_code = generate_room_code()

    #make sure room_code is unique and there are no collisions
    '''
    comment out all this for now to speed up without needing db integration
    while True:
        if not Room.query.filter_by(room_code=room_code).first():
            break

    room = Room(room_code = room_code)

    db.session.add(room)
    db.session.commit()
    '''
    return jsonify({"room_code": room_code}), 200


@app.route('/room_code_check', methods = ['POST'])
def room_code_check():
    data = request.get_json()
    room_code = data.get('room_code')

    '''
    # Check if room exists in the database
    room = Room.query.filter_by(room_code=room_code).first()

    if room:
        return jsonify({"exists": True}), 200
    else:
        return jsonify({"exists": False}), 200
    '''
    # Temporarily always return True for testing without db integration
    return jsonify({"ok": True}), 200




if __name__ == '__main__':
    app.run(debug=True)
    socketio.run(app, debug=True)

