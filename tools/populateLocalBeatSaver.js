const Bottleneck = require(`bottleneck`);
const config = require("../config.json");
const fetch = require('node-fetch');
const MongoClient = require("mongodb").MongoClient;

const apiLimiter = new Bottleneck({
    reservoir: 175,
    reservoirRefreshAmount: 175,
    //Millisecond - Second - Minutes
    reservoirRefreshInterval: 1000,

    minTime: 3
});

MongoClient.connect(config.mongourl, async (err, client) => {
    if (err !== null) throw new Error(`Database connection failed: ${err}`);

    const db = client.db(config.dbName);

    console.log("Connected to db")

    const newestMaps = await getNewestMap()
    const newestHex = newestMaps.docs[0].id;

    console.log(newestHex);
    let maxHexReached = false;
    let i = 1;

    let promises = [];

    while (!maxHexReached) {
        const hexValue = i.toString(16)

        promises.push(apiLimiter.schedule(async () => {
            const song = await getMonniApiMap(hexValue)
            if (song) { 
                db.collection("beatSaverLocal").replaceOne({ key: song.key}, song, { upsert: true })
             }
        }));

        if (hexValue === newestHex) {
            maxHexReached = true;
        }

        i++
    }

    await Promise.all(promises)
    console.log("Done, you may exit");
});

async function getNewestMap() {
    return await fetch("https://api.beatsaver.com/maps/latest?automapper=true&pageSize=1&sort=CREATED")
        .then(res => res.json())
}

async function getMonniApiMap(hex) {
    return await fetch(`http://api.monni.moe/map?k=${hex}`)
        .then(res => res.json())
        .catch(err => console.log("Not found hex:", hex))
}