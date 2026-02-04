from flask import Flask, request, session
from flask_socketio import SocketIO, join_room, leave_room, emit, rooms
from models import db, User, Room, Message, UserRoom
from flask import current_app
import jwt
from flask import g
from agent import run_agent

# Store user_id per socket connection to avoid session collision issues in threading mode
socket_user_map = {}
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

def register_socket_events(socketio: SocketIO):

    @socketio.on('connect')
    def handle_connect(auth):
        # #region agent log
        import logging
        import json
        import os
        from datetime import datetime
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        socket_id = request.sid
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "event": "connect_attempt",
            "socket_id": socket_id,
            "auth_present": auth is not None,
            "token_present": bool(auth.get('token') if auth else None)
        }
        logger.info(f"Socket connect attempt - socket_id: {socket_id}, auth present: {auth is not None}")
        try:
            log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.cursor', 'debug.log')
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            with open(log_path, 'a') as f:
                f.write(json.dumps(log_data) + '\n')
        except: pass
        # #endregion
        
        if not auth or not auth.get("token"):
            logger.warning(f"Socket connection rejected: No auth token - socket_id: {socket_id}")
            return False
        try:
            token = auth.get("token")
            payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = payload.get('user_id')
            logger.info(f"Socket connection authenticated - socket_id: {socket_id}, user_id: {user_id}")
        
        except jwt.ExpiredSignatureError:
            logger.warning(f"Socket connection rejected: Token expired - socket_id: {socket_id}")
            return False
        
        except jwt.InvalidTokenError as e:
            logger.warning(f"Socket connection rejected: Invalid token - socket_id: {socket_id}, error: {str(e)}")
            return False
        
        except Exception as e:
            logger.error(f"Socket connection error - socket_id: {socket_id}, error: {str(e)}")
            return False
        
        user_id = payload['user_id']
        # Store user_id per socket connection (not in Flask session to avoid threading issues)
        socket_user_map[socket_id] = user_id
        session['user_id'] = user_id  # Keep for backward compatibility
        
        # #region agent log
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "event": "connect_success",
            "socket_id": socket_id,
            "user_id": user_id,
            "session_user_id": session.get('user_id'),
            "socket_user_map_size": len(socket_user_map)
        }
        logger.info(f"Socket connected successfully - socket_id: {socket_id}, user_id: {user_id}, total_sockets: {len(socket_user_map)}")
        try:
            with open(log_path, 'a') as f:
                f.write(json.dumps(log_data) + '\n')
        except: pass
        # #endregion
        return True

    @socketio.on('join_room')
    def handle_join_room(data): #data is just payload of event. in this case, it looks like this: { room_code: 'some_code' }
        # #region agent log
        import logging
        import json
        import os
        from datetime import datetime
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        socket_id = request.sid
        log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.cursor', 'debug.log')
        # #endregion
        
        with current_app.app_context():
            room_code = data.get('room_code')
            # Get user_id from socket-specific storage (more reliable than session in threading mode)
            user_id = socket_user_map.get(socket_id)
            if not user_id:
                logger.error(f"join_room failed - socket_id: {socket_id}, no user_id found")
                emit("error", {"message": "Authentication required"})
                return
            
            # #region agent log
            current_rooms = rooms(socket_id)
            log_data = {
                "timestamp": datetime.now().isoformat(),
                "event": "join_room_attempt",
                "socket_id": socket_id,
                "user_id": user_id,
                "room_code": room_code,
                "current_rooms_before": list(current_rooms),
                "session_user_id": session.get('user_id')
            }
            logger.info(f"join_room attempt - socket_id: {socket_id}, user_id: {user_id}, room_code: {room_code}, current_rooms: {list(current_rooms)}")
            try:
                os.makedirs(os.path.dirname(log_path), exist_ok=True)
                with open(log_path, 'a') as f:
                    f.write(json.dumps(log_data) + '\n')
            except: pass
            # #endregion
            
            room = Room.query.filter_by(room_code=room_code).first()
            if room:
                # #region agent log
                # Get all sockets currently in the room BEFORE joining
                from flask_socketio import SocketIO as SIO
                # Note: We can't easily get all sockets in a room, but we can log what we know
                logger.info(f"BEFORE join_room - socket_id: {socket_id}, user_id: {user_id}, room_id: {room.room_id}, total_sockets_in_map: {len(socket_user_map)}")
                # #endregion
                
                join_room(room.room_id)
                #broadcast that new user has arrived
                user = User.query.filter_by(user_id=user_id).first()
                if not user:
                    logger.error(f"join_room failed - socket_id: {socket_id}, user not found: {user_id}")
                    emit("error", {"message": "User not found"})
                    return
                
                username = user.username
                # #region agent log
                rooms_after = rooms(socket_id)
                # Get all user_ids currently in socket_user_map for debugging
                all_socket_users = {sid: uid for sid, uid in socket_user_map.items()}
                log_data = {
                    "timestamp": datetime.now().isoformat(),
                    "event": "join_room_success",
                    "socket_id": socket_id,
                    "user_id": user_id,
                    "room_code": room_code,
                    "room_id": room.room_id,
                    "rooms_after": list(rooms_after),
                    "total_sockets": len(socket_user_map),
                    "all_socket_users": all_socket_users
                }
                logger.info(f"AFTER join_room - socket_id: {socket_id}, user_id: {user_id}, room_id: {room.room_id}, rooms_after: {list(rooms_after)}, total_sockets: {len(socket_user_map)}")
                try:
                    with open(log_path, 'a') as f:
                        f.write(json.dumps(log_data) + '\n')
                except: pass
                # #endregion
                
                emit("user_joined", {"user_id": user_id, "username": username}, room=room.room_id)
                
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
        with current_app.app_context():
            socket_id = request.sid
            room_code = data.get('room_code')
            message = data.get('message')
            # Get user_id from socket-specific storage (more reliable than session in threading mode)
            user_id = socket_user_map.get(socket_id)

            if not user_id:
                emit("error", {"message": "Authentication required"})
                return
            room = Room.query.filter_by(room_code=room_code).first()
            if room and room.room_id in rooms(socket_id):
                user = User.query.filter_by(user_id=user_id).first()
                if not user:
                    emit("error", {"message": "User not found"})
                    return
                
                username = user.username
                emit("new_message", {"user_id": user_id, "message": message, "username": username}, room=room.room_id)
                
                if message.strip().startswith('@agent'):
                    agent_input = message.strip()[6:].strip()  # Better parsing
                    if agent_input:  # Check if there's actual input
                        try:
                            # Emit "thinking" state to show the agent is processing
                            emit("agent_status", {"status": "thinking"}, room=room.room_id)
                            
                            # Pass room_id for memory context
                            agent_response = run_agent(agent_input, room_id=room.room_id)
                            
                            # Emit "responding" state briefly before the message
                            emit("agent_status", {"status": "responding"}, room=room.room_id)
                            
                            emit("new_message", {"user_id": "agent", "message": agent_response, "username": "Agent"}, room=room.room_id)
                            
                            # Set agent back to idle after responding
                            emit("agent_status", {"status": "idle"}, room=room.room_id)
                            
                            agent_message = Message(
                                user_id=user_id,
                                room_id=room.room_id,
                                content=f"[Agent] {agent_response}",
                            )
                            db.session.add(agent_message)
                            db.session.commit()
                        except Exception as e:
                            print(f"Agent error: {e}")
                            # Emit "failed" state on error
                            emit("agent_status", {"status": "failed", "error": str(e)}, room=room.room_id)
                            emit("error", {"message": "Agent error occurred"}, room=room.room_id)
                    
                new_message = Message(
                    user_id=user_id,
                    room_id=room.room_id,
                    content=message,
                    )
            
                db.session.add(new_message)
                db.session.commit()
            else:
                emit("error", {"message": "Room not found"})

    @socketio.on('disconnect')
    def handle_disconnect():
        # #region agent log
        import logging
        import json
        import os
        from datetime import datetime
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        socket_id = request.sid
        user_id = socket_user_map.get(socket_id)

        current_rooms_list = list(rooms(socket_id))
        log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.cursor', 'debug.log')
        log_data = {
            "timestamp": datetime.now().isoformat(),
            "event": "disconnect",
            "socket_id": socket_id,
            "user_id": user_id,
            "rooms": current_rooms_list,
            "session_user_id": session.get('user_id'),
            "socket_user_map_size_before": len(socket_user_map)
        }
        logger.warning(f"Socket disconnected - socket_id: {socket_id}, user_id: {user_id}, rooms: {current_rooms_list}")
        # Clean up socket from user map
        socket_user_map.pop(socket_id, None)
        log_data["socket_user_map_size_after"] = len(socket_user_map)
        try:
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            with open(log_path, 'a') as f:
                f.write(json.dumps(log_data) + '\n')
        except: pass
        # #endregion

    @socketio.on('leave_room')
    def handle_leave_room(data): #data looks like {room_code:...}
        '''
        steps:
        get the current socket id
        get the room_code from the data

        look up the room by code
        if the room exisits loop through and then delete

        '''
        # #region agent log
        import logging
        import json
        import os
        from datetime import datetime
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        socket_id = request.sid
        log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.cursor', 'debug.log')
        # #endregion
        
        with current_app.app_context():
            room_code = data.get('room_code')

            room = Room.query.filter_by(room_code=room_code).first()
            if room:
                user_id = socket_user_map.get(socket_id)

                # #region agent log
                rooms_before = list(rooms(socket_id))
                log_data = {
                    "timestamp": datetime.now().isoformat(),
                    "event": "leave_room",
                    "socket_id": socket_id,
                    "user_id": user_id,
                    "room_code": room_code,
                    "room_id": room.room_id,
                    "rooms_before": rooms_before
                }
                logger.info(f"leave_room - socket_id: {socket_id}, user_id: {user_id}, room_id: {room.room_id}")
                try:
                    os.makedirs(os.path.dirname(log_path), exist_ok=True)
                    with open(log_path, 'a') as f:
                        f.write(json.dumps(log_data) + '\n')
                except: pass
                # #endregion
                
                leave_room(room.room_id)
                #broadcast that user has left
                emit("user_left", {"user_id": user_id}, room=room.room_id)


