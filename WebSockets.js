const wss = new (require("ws").Server)({ noServer: true });

const rooms = {};
const clients = [], sockets = [];
const callbacks = [];

class ServerResponse {
	constructor(name, data) {
		this.name = name;
		this.data = data;
		this.timeStamp = Date.now();
	}
	toString() {
		return JSON.stringify(this);
	}
}

class Room {
	#callbacks;

	constructor(name) {
		this.name = name;
		this.sockets = [];
		this.#callbacks = [];
		rooms[this.name] = this;
	}
	get connected() {
		return this.sockets.length;
	}
	on(name, callback) {
		callback = callback.bind(this);
		this.#callbacks.push({ name, callback });
	}
	add(socket) {
		if (!this.sockets.includes(socket)) {
			this.sockets.push(socket);
			for (let i = 0; i < this.#callbacks.length; i++) {
				if (this.#callbacks[i].name === "connect") {
					this.#callbacks[i].callback(socket);
				}
			}
		}
	}
	remove(socket) {
		const idx = this.sockets.indexOf(socket);
		if (idx !== -1) {
			this.sockets.splice(idx, 1);
			for (let i = 0; i < this.#callbacks.length; i++) {
				if (this.#callbacks[i].name === "disconnect") {
					this.#callbacks[i].callback(socket);
				}
			}
		}
	}
	emit(name, data) {
		for (let i = 0; i < this.sockets.length; i++) {
			this.sockets[i].emit(name, data);
		}
	}
	broadcast(socket, name, data) {
		for (let i = 0; i < this.sockets.length; i++) {
			if (this.sockets[i] !== socket) {
				this.sockets[i].emit(name, data);
			}
		}
	}
	delete() {
		delete rooms[this.name];
	}
	id(socket) {
		for (let i = 0; i < this.sockets.length; i++) {
			if (this.sockets[i] === socket) {
				return i;
			}
		}
		return -1;
	}
}

class Socket {
	#authed;
	#client;
	#callbacks;

	constructor(client, user = null) {
		this.#client = client;
		if (user !== null) {
			this.user = user;
			this.#authed = true;
		} else {
			this.#authed = false;
		}
		this.#callbacks = [];
		this.#client.on("message", function(data) {
			const _data = data.toString("utf-8");
			if (_data === "ping") {
				return this.#client.send("pong");
			} else if (_data === "heartbeat") {
				return this.#client.send("heartbeat");
			}
			const { name, data: __data } = JSON.parse(_data);
			for (let i = 0; i < this.#callbacks.length; i++) {
				if (this.#callbacks[i].name === name) {
					this.#callbacks[i].callback(__data);
				}
			}
		}.bind(this));
		this.#client.on("close", function() {
			for (let i = 0; i < this.#callbacks.length; i++) {
				if (this.#callbacks[i].name === "disconnect") {
					this.#callbacks[i].callback(this);
				}
			}
			for (let i = 0; i < callbacks.length; i++) {
				if (callbacks[i].name === "disconnect") {
					callbacks[i].callback(this);
				}
			}
			const _rooms = Object.keys(rooms);
			for (let i = 0; i < _rooms.length; i++) {
				rooms[_rooms[i]].remove(this);
			}
			const idx = sockets.indexOf(this);
			clients.splice(idx, 1);
			sockets.splice(idx, 1);
		}.bind(this));
	}
	get id() {
		return sockets.indexOf(this);
	}
	get authed() {
		return this.#authed;
	}
	on(name, callback) {
		this.#callbacks.push({ name, callback });
	}
	emit(name, data) {
		this.#client.send(new ServerResponse(name, data).toString());
	}
	broadcast(name, data) {
		for (let i = 0; i < sockets.length; i++) {
			if (sockets[i] !== this) {
				sockets[i].emit(name, data);
			}
		}
	}
}

module.exports = function(server) {
	server.on("upgrade", function(req, _socket, head) {
		wss.handleUpgrade(req, _socket, head, function(client) {
			const authed = req.headers["x-replit-user-name"] && req.headers["x-replit-user-name"] !== "";
			const data = authed ? {} : null;
			if (authed) {
				const headers = Object.keys(req.headers);
				for (let i = 0; i < headers.length; i++) {
					if (headers[i].substr(0, 14) === "x-replit-user-") {
						data[headers[i].substr(14)] = req.headers[headers[i]];
					}
				}
			}
			clients.push(client);
			const socket = new Socket(client, authed ? data : null);
			sockets.push(socket);
			for (let i = 0; i < callbacks.length; i++) {
				if (callbacks[i].name === "connect") {
					callbacks[i].callback(socket, req);
				}
			}
		});
	});
	return {
		sockets,
		rooms,
		on: function(name, callback) {
			callbacks.push({ name, callback });
		},
		emit: function(name, data) {
			for (let i = 0; i < sockets.length; i++) {
				sockets[i].emit(name, data);
			}
		},
		Room,
		room: function(name) {
			return rooms[name] || null;
		}
	};
};