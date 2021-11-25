const WebScoketClient = require('websocket').client;
const webSocketServer = require('websocket').server;
const http = require('http');

class TAUtils {
    constructor(db, client) {
        this.db = db;
        this.client = client;

        const webSocketsServerPort = 8000;
        const server = http.createServer();
        server.listen(webSocketsServerPort);
        const wsServer = new webSocketServer({
            httpServer: server
        });





        const wsConnect = async function (client, serverconnection) {
            const wsClient = new WebScoketClient();
            wsClient.connect('ws://ta.monni.eu:3333');
            wsClient.on('connectFailed', function (error) {
                console.log('Connection failed error: ', error);
            });
            wsClient.on('connect', async function (conn, serverconnection) {
                console.log("TA websocket connected");

                wsServer.on('request', function (request) {
                    console.log('Recieved a new connection from origin ' + request.origin + '.');
                    // You can rewrite this part of the code to accept only the requests from allowed origin
                    const connection = request.accept();

                    console.log('Accepted new connection.');


                    conn.on('error', function (error) {
                        console.log('Connection error: ', error)
                    });
                    conn.on('close', function () {
                        console.log('TA websocket disconnected');
                        setTimeout(wsConnect, 1000 * 60, client)
                    });
                    conn.on('message', async function (message) {
                        try {
                            if (message.type === 'utf8') {
                                const msgJSON = JSON.parse(message.utf8Data);
                                const data = msgJSON.SpecificPacket;
                                if (msgJSON.Type !== 1 && data.Type !== 0 && data.Type !== 4 && data.Type !== 5 && data.Type !== 6 && data.Type !== 7 && data.Type !== 8 && data.Type !== 9 && data.Type !== 1 && data.Type !== 2) {
                                    //console.log(data);
                                }
                                if (data.Type === 1) {
                                    //console.log("statusupdate")
                                }
                                if (data.Type === 2) {
                                    //console.log("Player disconnected")
                                }
                                if (data.Type === 3) {
                                    if (data.ClientType === 0) console.log("Player connected")
                                    else if (data.ClientType === 1) console.log("Coordinator connected")

                                }
                                if (data.Type === 4) {
                                    {
                                        if(data?.SpecificPacket?.ChangedObject)
                                        {
                                            const object = data?.SpecificPacket?.ChangedObject;
                                            const playerScore = {
                                                playerName: object.Name,
                                                playerId: object.UserId,
                                                score: object.Score,
                                                combo: object.Combo,
                                                misses: object.Misses,
                                                acc: Math.round(object.Accuracy * 100 * 100) / 100
                                            }
                                            connection.sendUTF(JSON.stringify(playerScore));
                                        }
                                    }
                                }
                                if (msgJSON.Type === 5) //console.log("Room created")
                                if (data.Type === 6) {
                                    //console.log("Coordinator updated map choice")
                                }
                                if (msgJSON.Type === 7) //console.log("Room destroyed")
                                if (msgJSON.Type === 8) //console.log("Map chosen")
                                if (msgJSON.Type === 9) console.log("Map started")
                            }
                        }
                        catch (err) { console.log(err) }
                    });
                });
            });
        }
        wsConnect(client);
    }
}
module.exports = TAUtils;