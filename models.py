from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
db = SQLAlchemy()


'''
entiies we have are

user

message

room

user has many messages 
and has many rooms

a room has many messages

'''
class UserRoom(db.Model):
    __tablename__ = "user_rooms"

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        primary_key=True
    )
    room_id = db.Column(
        db.Integer,
        db.ForeignKey("rooms.room_id"),
        primary_key=True
    )

    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    role = db.Column(db.String(20), default="member")  # future-proof

    user = db.relationship("User", back_populates="room_links")
    room = db.relationship("Room", back_populates="user_links")


class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True)

    username = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

    oauth_provider = db.Column(db.String(50), nullable=False)
    oauth_id = db.Column(db.String(100), unique=True, nullable=False)

    # messages sent by this user
    messages = db.relationship(
        "Message",
        backref="user",
        lazy="selectin"
    )

    # association objects
    room_links = db.relationship(
        "UserRoom",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # convenience: user.rooms → list[Room]
    rooms = db.relationship(
        "Room",
        secondary="user_rooms",
        viewonly=True,
        lazy="selectin"
    )


class Room(db.Model):
    __tablename__ = "rooms"

    room_id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(80), nullable=False)
    room_code = db.Column(db.String(20), unique=True, nullable=False)

    # messages in this room
    messages = db.relationship(
        "Message",
        backref="room",
        lazy="selectin"
    )

    # association objects
    user_links = db.relationship(
        "UserRoom",
        back_populates="room",
        cascade="all, delete-orphan"
    )

    # convenience: room.users → list[User]
    users = db.relationship(
        "User",
        secondary="user_rooms",
        viewonly=True,
        lazy="selectin"
    )

class Message(db.Model):
    __tablename__ = "messages"

    message_id = db.Column(db.Integer, primary_key=True)

    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        index=True,
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        index=True,
        nullable=False
    )
    room_id = db.Column(
        db.Integer,
        db.ForeignKey("rooms.room_id"),
        index=True,
        nullable=False
    )


