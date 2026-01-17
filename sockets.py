from flask import Flask, request, session
from flask_socketio import SocketIO, join_room, leave_room, emit, rooms
from models import db, User, Room, Message, UserRoom
'''
websocket planning

1. connect
    - browser opens a conenction to the server
    - server associated that connection with:
        - a user if authetnicated
        - socketId

    These socket to user mapping are stored in memory
    with a dictionary

    like each room_id will map to a list of sockets.
    maybe we can make this a set to avoid duplcaites and get o(1) removals and adds



2. Join a room
    - browser sends a "join room" event with the room code
    - server looks up the room by code
    - server then adds the user_id to that socket in memory

3. Send a message
    - Client(browser) emits(sends) an event
    - The server
        - looks up the socketId and room making sure they match up in the inmemory 
        - writes message to the db
        - emits(broadcasts) the message to all scoekts in that room

        maybe broadcast first and then write to db to improve latency

4. When a browser tab closes or refreshes:
    - socket disconnetcs
    - server remvoes socket from room
    - broadcast user left evnet

    for this we need to know which rooms this socket belonged to
    for this, I'm thinking we can have socket to rooms dictionary as well


Client -> server events:
  - join_room
  {
    room_code,
  
  }
  - send_message
  {
    room_code,
    message:,
  }
  

Server -> client events:

 - new_message
    {
        room_code:,
        user_id:,
        message:,
        timestamp:,
    }
 - user_joined
    { 
        user_id:,
    }

 - user_left
    {
        user_id:,
    }

'''

app = Flask(__name__)
socketio = SocketIO(app)

@socketio.on('join_room')
def handle_join_room(data): #data is just payload of event. in this case, it looks like this: { room_code: 'some_code' }
    room_code = data.get('room_code')
    #get user_id from oauth, just do this for now
    user_id = data.get('user_id')  
    socket_id = request.sid
    room = Room.query.filter_by(room_code=room_code).first()
    if room:
        join_room(room.room_id)
        #broadcast that new user has arrived
        emit("user_joined", {"user_id": user_id}, room=room.room_id)
        
        #create association in db if it doesn't exists
        user_room_link = UserRoom.query.filter_by(user_id=user_id, room_id=room.room_id).first()
        
        if not user_room_link:
            new_link = UserRoom(user_id=user_id, room_id=room.room_id)
            db.session.add(new_link)
            db.session.commit()
    else:
        emit("error", {"message": "Room not found"})


@socketio.on('send_message')
def handle_send_message(data):
    room_code = data.get('room_code')
    message = data.get('message')
    #get user_id from oauth, just do this for now
    user_id = data.get('user_id') 
    socket_id = request.sid
    room = Room.query.filter_by(room_code=room_code).first()
    if room and room.room_id in rooms(socket_id):
        emit("new_message", {"user_id": user_id, "message": message}, room=room.room_id)

        new_message = Message(
            user_id=user_id,
            room_id=room.room_id,
            content=message
            )
    
        db.session.add(new_message)
        db.session.commit()
    else:
        emit("error", {"message": "Room not found"})

@socketio.on('leave_room')
def handle_leave_room(data): #data looks like {room_code:...}
   '''
   steps:
   get the current socket id
   get the room_code from the data

   look up the room by code
   if the room exisits loop through and then delete

   '''
   room_code = data.get('room_code')

   room = Room.query.filter_by(room_code=room_code).first()
   if room:
       leave_room(room.room_id)
       #broadcast that user has left
       #get the user_id from data for now do oauth later
       emit("user_left", {"user_id": data.get('user_id')}, room=room.room_id)

