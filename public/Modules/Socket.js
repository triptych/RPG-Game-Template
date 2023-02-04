class ClientRequest {
	constructor(name, data) {
		this.name = name;
		this.data = data;
		this.timeStamp = Date.now();
	}
	toString() {
		return JSON.stringify(this);
	}
}

class Socket {
	#closed;
	#callbacks;
	#pings;
	#socket;
	#heartbeating;

	constructor(url) {
		if (!url) {
			this.url = "wss://" + window.location.host;
		} else if (url.substr(0, 5) === "https") {
			this.url = "wss" + url.substr(5);
		} else if (url.substr(0, 4) === "http") {
			this.url = "ws" + url.substr(4);
		} else if (url.substr(0, 2) !== "ws") {
			this.url = "wss://" + url;
		} else {
			this.url = url;
		}
		this.#closed = false;
		this.#callbacks = [];
		this.#initSocket();
	}
	#initSocket() {
		this.#pings = [];
		this.connected = false;
		this.#socket = new WebSocket(this.url);
		let heartbeat;
		this.#socket.addEventListener("open", function() {
			if (this.#socket.readyState === 1) {
				this.connected = true;
				this.#heartbeating = true;
				heartbeat = setInterval(function() {
					if (!this.#heartbeating) {
						clearInterval(heartbeat);
						console.info("[Socket.js] Disconnected from " + this.url + ".");
						this.#initSocket();
					}
					this.#heartbeat();
				}.bind(this), 2000);
			}
			for (let i = 0; i < this.#callbacks.length; i++) {
				if (this.#callbacks[i].name === "connect") {
					const { once } = this.#callbacks[i];
					this.#callbacks[i].callback();
					if (once) {
						i--;
					}
				}
			}
		}.bind(this));
		this.#socket.addEventListener("message", function(response) {
			if (response.data === "pong") {
				const ping = Date.now() - this.#pings.shift();
				for (let i = 0; i < this.#callbacks.length; i++) {
					if (this.#callbacks[i].name === "pong") {
						const { once } = this.#callbacks[i];
						this.#callbacks[i].callback(ping);
						if (once) {
							i--;
						}
					}
				}
				return;
			} else if (response.data === "heartbeat") {
				this.#heartbeating = true;
				return;
			}
			const { name, data: _data } = JSON.parse(response.data);
			for (let i = 0; i < this.#callbacks.length; i++) {
				if (this.#callbacks[i].name === name) {
					const { once } = this.#callbacks[i];
					this.#callbacks[i].callback(_data);
					if (once) {
						i--;
					}
				}
			}
		}.bind(this));
		this.#socket.addEventListener("error", function(err) {
			for (let i = 0; i < this.#callbacks.length; i++) {
				if (this.#callbacks[i].name === "error") {
					const { once } = this.#callbacks[i];
					this.#callbacks[i].callback(err);
					if (once) {
						i--;
					}
				}
			}
		}.bind(this));
		this.#socket.addEventListener("close", function() {
			this.connected = false;
			if (!this.#closed) {
				clearInterval(heartbeat);
				console.log("[Socket.js] Disconnected from " + this.url + ".");
				this.#initSocket();
			}
			for (let i = 0; i < this.#callbacks.length; i++) {
				if (this.#callbacks[i].name === "disconnect") {
					const { once } = this.#callbacks[i];
					this.#callbacks[i].callback();
					if (once) {
						i--;
					}
				}
			}
		}.bind(this));
	}
	#heartbeat() {
		if (this.connected) {
			if (this.#socket.readyState === 1) {
				this.connected = true;
				this.#socket.send("heartbeat");
				this.#heartbeating = false;
			} else {
				this.connected = false;
				this.#heartbeating = false;
			}
		}
	}
	once(name, callback) {
		const callbackObj = {
			name,
			callback: function(data) {
				callback(data);
				this.#callbacks.splice(this.#callbacks.indexOf(callbackObj), 1);
			}.bind(this),
			once: true
		};
		this.#callbacks.push(callbackObj);
	}
	on(name, callback) {
		this.#callbacks.push({ name, callback: callback.bind(this), once: false });
	}
	ping() {
		if (this.connected) {
			this.#pings.push(Date.now());
			this.#socket.send("ping");
		}
	}
	emit(name, data) {
		if (this.connected) {
			this.#socket.send(new ClientRequest(name, data).toString());
		}
	}
	close(reason) {
		this.#socket.close(1000, reason);
		this.#closed = true;
	}
}

export { Socket as default };