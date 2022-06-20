const { BehaviorSubject } = rxjs;

class Game{
    constructor(){
        this.wallet = new BehaviorSubject();
        this.energy = new BehaviorSubject(0);
        this.balance = new BehaviorSubject(0);
        this.canvas = document.querySelector("#canvas");
        this.ctx = this.canvas.getContext("2d");
        this.loadingSreen = document.querySelector("#loadingSreen");
        this.playScreen = document.querySelector("#playScreen");
        this.server = "ws://localhost:8999";
        this.network = "http://localhost:7545";
            
        this.bindData();        
        this.metamaskConnect();
        this.render();
    }

    async loadContracts(){
        try{
            this.networkConn = new Web3(this.network);
            this.tokenContractAddress = "0x9078f6C05508EEf46F1c390e50Aca47b66dB1069";
            this.tokenContractAbi = await this.loadABI("SnakeCoin.abi.json");
            this.tokenContract = new this.networkConn.eth.Contract(this.tokenContractAbi, this.tokenContractAddress);
            const balance = await this.tokenContract.methods.balanceOf(this.wallet.value).call();
            this.balance.next(balance);
            return this;
        }
        catch(e){
            console.log(e);
            return null;
        }  
    }

    async loadABI(url){
        const response = await fetch(url);
        return await response.json();
    }

    bindData(){
        this.wallet.subscribe({
            next: (value) => {
                if(typeof value == "string") 
                    document.querySelector("#wallet").innerHTML = value.substr(0, 5) + "..." + value.substr(value.length - 4)
            }
        });

        this.balance.subscribe({
            next: (value) => {
                if(value)
                    document.querySelector("#balance").innerHTML = value
            }
        });

        this.energy.subscribe({
            next: (value) => {
                if(value)
                    document.querySelector("#energy").innerHTML = value
            }
        });
    }

    async metamaskConnect(){
        if(!window.ethereum || !window.ethereum.isMetaMask) {
            alert("Please install MetaMask");
            return;
        }

        try{
            const wallets = await ethereum.request({ method: 'eth_requestAccounts' });
       
            if(wallets && wallets.length > 0)
                this.wallet.next(wallets[0]);
        }
        catch(e){
            console.log(e);
        }
    }

    async render(){
        this.ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.ctx.fillStyle = "#EFEFFE";
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    async loadProto(){
        try{
            this.proto = await protobuf.load(`server.proto`);
            return this;
        }
        catch(e){
            return null;
        }        
    }

    getTypeMessage(buffer){
        try{
            const headerParser = this.proto.lookupType("server.MessageType");
            const headerRaw = headerParser.decode(new Uint8Array(buffer));
            return headerRaw.type;
        }
        catch(e){
            return null;
        }
    }

    async parseMessage(type, buffer, socket){
        switch(type){
            case 1: //UUIDValidation
                const cacheToken = localStorage.getItem('session');

                if(cacheToken){
                    socket.send(this.createProtoMessage("ClientAuth", JSON.parse(cacheToken)));
                }
                else{
                    const headerParser = this.proto.lookupType("server.UUIDValidation");
                    const message = headerParser.decode(new Uint8Array(buffer));

                    const signMessage = {
                        wallet: this.wallet.value,
                        uuid: message.uuid,
                        nonce: this.getRandomInt(1, 1000000000).toString(16)
                    };

                    const sign = await this.signMessage(signMessage);
                    const finalMessage = { ...signMessage, type: 2, sign };

                    socket.send(this.createProtoMessage("ClientAuth", finalMessage));
                    localStorage.setItem('session', JSON.stringify(finalMessage));
                }
                
            break;
            case 3: //Profile
                const Profile = this.proto.lookupType("server.Profile");
                const profile = Profile.decode(new Uint8Array(buffer));
                this.energy.next(profile.energies);
                this.loadingSreen.style.display = "none";
                this.playScreen.style.display = "block";
            break;
        }
    }

    async signMessage(message){
        const signature = await ethereum.request({
            method: "personal_sign",
            params: [`${message.wallet}:${message.uuid}:${message.nonce}`, this.wallet.value],
        });

        return signature;
    }

    getKeyFromProtoEnum(map, val){
        return Object.keys(map).find(key => map[key] === val);
    }

    async createWebSocket(){
        try{
            console.log(`Connecting to server ${this.server}...`);
            
            this.ws = new WebSocket(this.server);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.log("Connected");
            }

            this.ws.onmessage = async (e) => {                
                const type = await this.getTypeMessage(e.data);
                await this.parseMessage(type, e.data, this.ws);
            }

            this.ws.onclose = () => {
                console.log("Disconnected");
            }

            this.ws.onerror = (e) => {
                console.error(e);
            }

            return this;
        }
        catch(e){
            console.error(e);
            return null;
        }
    }

    getRandomInt(min, max){
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min;
    }

    createProtoMessage(type, data){
        const Messsage = this.proto.root.lookup(`server.${type}`);
        const message = Messsage.create(data);
        const validateMessage = Messsage.verify(data);

        if (validateMessage){
            console.log(validateMessage);
            throw Error(validateMessage);
        }

        const buffer = Messsage.encode(message).finish();
        return buffer;
    }
}

window.addEventListener("load", async (event) => {
    const game = new Game();

    game.loadProto()
        .then(async (game) => await game.loadContracts())
        .then(async (game) => await game.createWebSocket());
});