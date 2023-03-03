const Bottleneck = require(`bottleneck`);
const fetch = require('node-fetch');
const atob = require('atob');
const WebScoketClient = require('websocket').client;
const yauzl = require("yauzl");
const fs = require("fs");

const options = {
    headers: { 'User-Agent': "FinnishBSDiscordBot/1.0.0" }
}

const BeatSaverLimiter = new Bottleneck({
    reservoir: 50,
    reservoirRefreshAmount: 50,
    //Millisecond - Second - Minutes
    reservoirRefreshInterval: 1000 * 60 * 2,

    minTime: 1000
})

class BeatSaverUtils {
    constructor(db, client) {
        this.db = db;
        this.client = client;

        const wsConnect = async function (client) {
            const wsClient = new WebScoketClient();
            wsClient.connect('wss://ws.beatsaver.com/maps');
            wsClient.on('connectFailed', function (error) {
                console.log('Connection failed error: ', error);
            });
            wsClient.on('connect', async function (conn) {
                console.log("BeatSaver websocket connected");
                conn.on('error', function (error) {
                    console.log('Connection error: ', error)
                });
                conn.on('close', function () {
                    console.log('BeatSaver websocket disconnected');
                    setTimeout(wsConnect, 1000 * 60, client)
                });
                conn.on('message', async function (message) {
                    try {
                        if (message.type === 'utf8') {
                            const msgJSON = JSON.parse(message.utf8Data);
                            if (msgJSON["type"] === 'MAP_UPDATE') {
                                await client.beatsaver.addMapToDb(msgJSON["msg"]);
                            }
                            else if (msgJSON["type"] === 'MAP_DELETE') {
                                await client.db.collection("beatSaverLocal").updateOne({ key: msgJSON["msg"].toUpperCase() }, { $set: { deleted: true } });
                            }
                            else {
                                console.log("unrecognized msg type: ", msgJSON.type)
                            }
                        }
                        else {
                            console.log("Non utf-8 msg", message);
                        }
                    }
                    catch (err) { console.log(err) }
                });
            });
        }
        wsConnect(client);
    }

    async addMapToDb(map) {
        let versionArray = [];
        try {
            for (let i = 0; i < map.versions.length; i++) {
                map.versions[i].hash = map.versions[i].hash.toUpperCase();
                map.versions[i].createdAt = new Date(map.versions[i].createdAt).getTime();
                versionArray.push(map.versions[i]);
            }
            const mapObject = {
                key: map.id.toUpperCase(),
                description: map.description,
                uploader: {
                    id: map.uploader.id,
                    name: map.uploader.name,
                    hash: map.uploader.hash
                },
                metadata: {
                    bpm: map.metadata.bpm,
                    duration: map.metadata.duration,
                    songName: map.metadata.songName,
                    songSubName: map.metadata.songSubName,
                    songAuthorName: map.metadata.songAuthorName,
                    levelAuthorName: map.metadata.levelAuthorName
                },
                stats: {
                    plays: map.stats.plays,
                    downloads: map.stats.downloads,
                    upvotes: map.stats.upvotes,
                    downvotes: map.stats.downvotes,
                },
                uploaded: new Date(map.uploaded).getTime(),
                automapper: map.automapper
            }
            await this.db.collection("beatSaverLocal").updateOne({ key: mapObject.key }, { $set: mapObject }, { upsert: true });
            for (let i = 0; i < versionArray.length; i++) {
                await this.db.collection("beatSaverLocal").updateOne({ key: mapObject.key }, { $addToSet: { versions: versionArray[i] } }, { upsert: true });
            }
            await this.db.collection("beatSaverLocal").updateOne({ key: mapObject.key }, { $push: { versions: { $each: [], $sort: { createdAt: -1 } } } });
        }
        catch (err) {
            console.log("Error " + err + "\nWith map ")
            console.log(map);
        }
    }

    async findMapByHash(hash) {
        let map = await this.db.collection("beatSaverLocal").findOne({ versions: { $elemMatch: { hash: hash.toUpperCase() } } });
        if (map?.notFound) {
            return null;
        }
        else if (!map && map?.notFound !== false) {
            console.log(`Hash: ${hash}`)
            try {
                map = await this.getMapDataByHash(hash);
                if (map == null) return null;
                else {
                    map = await this.db.collection("beatSaverLocal").findOne({ versions: { $elemMatch: { hash: hash.toUpperCase() } } });
                }
            } catch (err) {
                console.log(err);
                return null;
            }
        }
        return map;
    }

    async bulkFindMapsByHash(arrayOfHash) {
        arrayOfHash = arrayOfHash.map(e => e.toUpperCase());
        arrayOfHash = [...new Set(arrayOfHash)]; // Remove duplicates
        let maps = [];
        const batches = this.batcher(arrayOfHash, 100) // Use the batcher function to split the array into smaller batches
        for (let i = 0; i < batches.length; i++) {
            const currentBatch = batches[i];
            let batchMaps = await this.db.collection("beatSaverLocal").find({ "versions.hash": { $in: currentBatch } }).toArray();
            await Promise.all(
                // We need to Promise all otherwise we get issues with Promises that are generated inside
                currentBatch.map(async (e, j) => {
                    if (batchMaps.findIndex(x => x.versions.find(y => y.hash === e)) === -1) {
                        const tmpMap = await this.getMapDataByHash(e);
                        if (tmpMap !== null) batchMaps.splice(j, 0, tmpMap);
                    }
                })
            )
            maps.push(...batchMaps);
        }
        return maps;
    }

    async findMapByKey(key) {
        let map = await this.db.collection("beatSaverLocal").findOne({ key: key.toUpperCase() });
        if (map?.notFound) {
            return null;
        }
        else if (!map && map?.notFound !== false) {
            console.log(`Key: ${key}`)
            try {
                map = await this.getMapDataByKey(key);
                if (map == null) return null;
                else {
                    map = await this.db.collection("beatSaverLocal").findOne({ key: key.toUpperCase() });
                }
            } catch (err) {
                console.log(err);
                return null;
            }
        }
        return map;
    }

    async bulkFindMapsByKey(arrayOfKeys) {
        // TODO

        arrayOfKeys = arrayOfKeys.map(e => e.toUpperCase());
        let maps = await this.db.collection("beatSaverLocal").find({ key: { $in: arrayOfKeys } })

        // How to solve missing maps as they are not returned?
        // Compare arrayOfHash[i] to maps[i] and if it does not match fill in that spot with  
        // Use getMapDataByHash if not found?
        // If not actually found insert empty element into array on that spot?
    }

    async checkMapStatus(res, finder) {
        if (res.ok) return res
        else {
            let hashOrKey;
            if (finder.length > 10) hashOrKey = { hash: finder }
            else hashOrKey = { key: finder }

            //await this.client.db.collection("beatSaverLocal").updateOne(hashOrKey, { $set: { notFound: true } }, { upsert: true });
            throw new Error(res.statusText);
        }
    }

    async getMapDataByKey(key) {
        console.log("Getting data from BeatSaver instead of DB.");

        let map = await BeatSaverLimiter.schedule(async () => fetch(`https://api.beatsaver.com/maps/id/${key}`, options)
            .then(res => this.checkMapStatus(res, key))
            .then(res => res.json())
            .catch(err => console.log(err)));

        if (map != undefined) {
            await this.addMapToDb(map);
            return map;
        }
        else {
            console.log("Failed to get map data.\nKey: " + key);
            return null;
        }
    }

    async getMapDataByHash(hash) {
        console.log("Getting data from BeatSaver instead of DB:", hash);

        let mapData = await BeatSaverLimiter.schedule(async () => fetch(`https://api.beatsaver.com/maps/hash/${hash}`, options)
            .then(res => this.checkMapStatus(res, hash))
            .then(res => res.json())
            .catch(err => console.log(err)))

        if (mapData != undefined) {
            await this.addMapToDb(mapData);
            return mapData;
        }
        else {
            console.log("Failed to get map data.\nHash: " + hash);
            return null;
        }
    }

    async getMapDataGithub() {
        console.log("Pulling scraped BeatSaver data from github.")
        if (!fs.existsSync('./ScrapeSaverData/')) {
            fs.mkdir('./ScrapeSaverData/', (err) => {
                if (err) return console.error(err);
            },
                console.log('Directory ./ScrapeSaverData/ created successfully!')
            );
        }
        const data = await fetch(`https://github.com/andruzzzhka/BeatSaberScrappedData/raw/master/combinedScrappedData.zip`)
            .then(res => {
                const dest = fs.createWriteStream('./ScrapeSaverData/Latest.zip');
                res.body.pipe(dest);
            })
            .catch(err => { console.log(err) });

        //Should propably promisify but lazy, #FIX
        await new Promise(r => setTimeout(r, 8000));

        yauzl.open("./ScrapeSaverData/Latest.zip", { lazyEntries: true }, function (err, zipfile) {
            if (err) throw err;
            zipfile.readEntry();
            zipfile.on("entry", function (entry) {
                if (/\/$/.test(entry.fileName)) {
                    zipfile.readEntry();
                } else {
                    zipfile.openReadStream(entry, function (err, readStream) {
                        if (err) throw err;
                        readStream.on("end", function () {
                            zipfile.readEntry();
                        });
                        readStream.pipe(fs.WriteStream("./ScrapeSaverData/Latest.json"))
                    });
                }
            });
        });

        //Same with this one
        await new Promise(r => setTimeout(r, 8000));

        try {
            fs.readFile("./ScrapeSaverData/Latest.json", 'utf8', (err, data) => {
                if (err) console.log(err)
                const jsonData = JSON.parse(data);
                console.log(jsonData[0]);
                for (let i = 0; i < jsonData.length; i++) {
                    const m = jsonData[i]
                    const map = {
                        id: m.Key,
                        description: null,
                        uploader: {
                            id: null,
                            name: null,
                            hash: null
                        },
                        metadata: {
                            bpm: m.Bpm,
                            duration: m.Duration,
                            songName: m.SongName,
                            songSubName: m.SongSubName,
                            songAuthorName: m.SongAuthorName,
                            levelAuthorName: m.LevelAuthorName,
                        },
                        stats: {
                            plays: null,
                            downloads: m.Downloads,
                            upvotes: m.Upvotes,
                            downvotes: m.Downvotes
                        },
                        uploaded: m.Uploaded,
                        automapper: false,
                        versions: []
                    }
                    const version = {
                        createdAt: m.Uploaded,
                        hash: m.Hash,
                        state: null,
                        sageScore: null,
                        diffs: [],
                        downloadURL: `https://cdn.beatsaver.com/${m.Hash.toLowerCase()}.zip`,
                        coverURL: `https://cdn.beatsaver.com/${m.Hash.toLowerCase()}.jpg`,
                        previewURL: `https://cdn.beatsaver.com/${m.Hash.toLowerCase()}.mp3`,
                    }
                    for (let j = 0; j < m.Diffs.length; j++) {
                        const d = m.Diffs[j]
                        const diff = {
                            njs: d.Njs,
                            offset: d.NjstOffset,
                            notes: d.Notes,
                            bombs: d.Bombs,
                            obstacles: d.Obstacles,
                            nps: d.Notes / m.Duration,
                            length: (m.Duration / 60) * m.Bpm,
                            characteristic: d.Char,
                            difficulty: d.Diff,
                            seconds: m.Duration
                        }
                        version.diffs.push(diff);
                    }
                    map.versions.push(version);
                    this.addMapToDb(map);
                }

            })
        }
        catch (err) { console.log(err); }
        console.log("Done pulling & inserting scraped BeatSaver data from github.")
    }

    convertDiffNameScoreSaber(diffName) {
        if (diffName.toLowerCase() === "expert+") return "_ExpertPlus_SoloStandard"
        else if (diffName.toLowerCase() === "expert") return "_Expert_SoloStandard"
        else if (diffName.toLowerCase() === "hard") return "_Hard_SoloStandard"
        else if (diffName.toLowerCase() === "normal") return "_Normal_SoloStandard"
        else return "_Easy_SoloStandard"
    }

    convertDiffNameVisual(diffName) {
        if (diffName === "_ExpertPlus_SoloStandard" || diffName === "expertPlus" || diffName === "ExpertPlus") return "Expert+"
        else if (diffName === "_Expert_SoloStandard" || diffName === "expert" || diffName === "Expert") return "Expert"
        else if (diffName === "_Hard_SoloStandard" || diffName === "hard" || diffName === "Hard") return "Hard"
        else if (diffName === "_Normal_SoloStandard" || diffName === "normal" || diffName === "Normal") return "Normal"
        else return "Easy"
    }

    convertDiffNameBeatSaver(diffName) {
        if (diffName === "_ExpertPlus_Solo" + this.findPlayCategory(diffName) || diffName === "ExpertPlus" || diffName === "expertPlus") return "ExpertPlus"
        else if (diffName === "_Expert_Solo" + this.findPlayCategory(diffName) || diffName === "Expert" || diffName === "expert") return "Expert"
        else if (diffName === "_Hard_Solo" + this.findPlayCategory(diffName) || diffName === "Hard" || diffName === "hard") return "Hard"
        else if (diffName === "_Normal_Solo" + this.findPlayCategory(diffName) || diffName === "Normal" || diffName === "normal") return "Normal"
        else return "Easy"
    }

    findPlayCategory(diffName) {
        if (diffName.endsWith("Standard")) return "Standard"
        else if (diffName.endsWith("Lawless")) return "Lawless"
        else if (diffName.endsWith("NoArrows")) return "NoArrows"
        else if (diffName.endsWith("OneSaber")) return "OneSaber"
        else if (diffName.endsWith("360Degree")) return "360Degree"
        else return "90Degree"
    }

    isKey(key) {
        const matches = key.match(/^[a-fA-F0-9]+$/);
        if (!matches || key.length > 6) return false;
        else return true;
    }

    async newestKeyHex() {
        const query = await this.db.collection("beatSaverLocal").aggregate(
            [
                { $project: { key: 1, keyLength: { $strLenCP: "$key" } } },
                { $sort: { keyLength: -1, key: -1 } },
                { $limit: 1 }
            ]
        ).toArray();
        return query[0].key;
    }

    missingHexKeys() {

    }

    batcher = (arr, size) => arr.length > size ? [arr.slice(0, size), ...this.batcher(arr.slice(size), size)] : [arr];
}
module.exports = BeatSaverUtils;