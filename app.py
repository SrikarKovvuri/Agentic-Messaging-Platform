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
    while True:
        if not Room.query.filter_by(room_code=room_code).first():
            break

    room = Room(room_code = room_code)

    db.session.add(room)
    db.session.commit()
    '''
    return jsonify({"room_code": room_code}), 200

    '''
    Flow: 

    user can either click on join room or create room

    if the user clicks on create room. THen the frontend sends a 
    post request to /create_room endpoint 


    next steps: we bascially just need 
    '''




if __name__ == '__main__':
    app.run(debug=True)
    socketio.run(app, debug=True)

