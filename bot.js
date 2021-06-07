const config = require('./config.json')

const Discord = require('discord.js');
const client = new Discord.Client();
const prefix = config.prefix;
const adminchannelID = config.adminchannelID;

const Bottleneck = require(`bottleneck`);
const fetch = require('node-fetch');

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const atob = require('atob');

const url = 'mongodb://localhost:27017';
const dbName = 'discordRankBot';

const schedule = require('node-schedule');

const options = {
    headers: { 'User-Agent': "FinnishBSDiscordBot/1.0.0" }
}

const limiter = new Bottleneck({
    reservoir: 70,
    reservoirRefreshAmount: 70,
    reservoirRefreshInterval: 60 * 1000,

    minTime: 25
});

const BeatSaverLimiter = new Bottleneck({
    reservoir: 60,
    reservoirRefreshAmount: 60,
    reservoirRefreshInterval: 60 * 60 * 1000,

    minTime: 1000
})

limiter.on("failed", async (error, jobInfo) => {
    const id = jobInfo.options.id;
    console.warn(`Job ${id} failed: ${error}`);

    if (jobInfo.retryCount < 2) {
        console.log(`Retrying job ${id} in ${(jobInfo.retryCount + 1) * 250}ms`);
        return 250 * (jobInfo.retryCount + 1);
    }
    else if (jobInfo.retryCount === 2) {
        console.log(`Retrying job ${id} in 1 minute.`)
        return 1000 * 60
    }

});

limiter.on("retry", (error, jobInfo) => console.log(`Retrying ${jobInfo.options.id} soon.`));


MongoClient.connect(url, async (err, client) => {
    assert.strictEqual(null, err);
    console.log("Connected successfully to database");
    const db = client.db(dbName);

    await discordlogin();
    discordClientReady();
    await memberLeft(db);
    await memberJoined();

    await commandHandler(db);

    const job = schedule.scheduleJob('0 14 * * *', function () {
        getBeatSaverMapDataGithub(db);
    });
});

async function memberJoined() {
    client.on('guildMemberAdd', member => {
        const role = member.guild.roles.cache.find(role => role.name === "landed");
        member.roles.add(role);

        client.channels.cache.get(adminchannelID).send(`${member.user.username} joined the server.`)

        setTimeout(newMemberTimerMessage, 1000 * 60 * 60 * 24, member);
    })
}

function newMemberTimerMessage(member) {
    client.channels.cache.get(adminchannelID).send(`${member} joined 24h ago`);
}

async function memberLeft(db) {
    client.on('guildMemberRemove', (member) => {
        client.channels.cache.get(adminchannelID).send(`${member.user.username} left the server.`)
        const myquery = { discId: member.id };
        db.collection("discordRankBotUsers").find(myquery).toArray(function (err, dbres) {
            if (err) throw err;

            if (!dbres[0]?.discId) {
                console.log(`${member.user.username} left server but was not in db`);
            }
            else {
                db.collection("discordRankBotUsers").deleteOne(myquery, function (err) {
                    if (err) throw err;
                    else console.log(`${member.user.username} left server so deleted from the database`);
                })
            }
        })
    });
}

async function discordlogin() {
    await client.login(config.token);
}

function discordClientReady() {
    client.on('ready', async () => {
        console.log('Ready to rumble!');
        await statusOff();
    });
}

function convertDiffNameVisual(diffName) {
    if (diffName === "_ExpertPlus_SoloStandard") return "Expert+"
    else if (diffName === "_Expert_SoloStandard") return "Expert"
    else if (diffName === "_Hard_SoloStandard") return "Hard"
    else if (diffName === "_Normal_SoloStandard") return "Normal"
    else return "Easy"
}

function convertDiffNameBeatSaver(diffName) {
    if (diffName === "_ExpertPlus_SoloStandard" || diffName === "ExpertPlus") return "expertPlus"
    else if (diffName === "_Expert_SoloStandard" || diffName === "Expert") return "expert"
    else if (diffName === "_Hard_SoloStandard" || diffName === "Hard") return "hard"
    else if (diffName === "_Normal_SoloStandard" || diffName === "Normal") return "normal"
    else return "easy"
}

async function statusOff() {
    await client.user.setActivity("Updates OFF");
}

function checkIfOwner(message) {
    if (message.author.id === message.guild.ownerID) {
        console.log(message.guild.ownerID);
        return true;
    }
    else message.channel.send(`Sorry you lack the permissions for this command.`);
}

async function getOnePageRecentFromScoreSaber(scoreSaberID, db, leaderboardId, page) {
    let res = await limiter.schedule({ id: `Recent ${scoreSaberID} page: ${page}` }, async () => fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/scores/recent/${page}`)
        .then(res => res.json())
        .catch(err => { throw new Error("Failed api request: ") + err }));
    for (let i = 0; i < res.scores?.length; i++) {
        if (leaderboardId === res[i].scores.leaderboardId) {
            await db.collection("discordRankBotScores").updateOne(
                { leaderboardId: res.scores[i].leaderboardId, player: scoreSaberID },
                { $set: { pp: res.scores[i].pp } });
        }
    }
}

async function getAllScoresFromScoreSaber(scoreSaberID, db) {
    let pageOfScoreSaber = 1;
    let reachedLastPage = false;

    let totalScores = 0;

    while (!reachedLastPage) {
        let executions = 0;
        let res = await limiter.schedule({ id: `Recent ${scoreSaberID} page:${pageOfScoreSaber}` }, async () => fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/scores/recent/${pageOfScoreSaber}`)
            .then(res => res.json())
            .catch(err => { throw new Error("Failed api request: " + err) }));
        console.log(`Page: ${pageOfScoreSaber}`);

        executions++;
        if (executions === 3) console.log(`Failed multiple times to get scores from ${scoreSaberID} page: ${pageOfScoreSaber}.`)
        else {
            for (let i = 0; i < res.scores?.length; i++) {
                totalScores++;
                await AddPlayToDb(res.scores[i], db, scoreSaberID);
            }
        }
        if (res.scores?.length === 8) pageOfScoreSaber++;
        else reachedLastPage = true
    }
    console.log(`Reached last page of scores for ${scoreSaberID}. Total scores: ${totalScores} on a total of ${pageOfScoreSaber} pages.`);
}

async function getRecentScoresFromScoreSaber(scoreSaberID, db) {
    let foundSeenPlay = false;
    let pageOfScoreSaber = 1;

    let dbresLatestScore = await db.collection("discordRankBotScores").find({ player: scoreSaberID }).sort({ date: -1 }).limit(1).toArray();

    while (!foundSeenPlay) {
        let executions = 0;
        let res = await limiter.schedule({ id: `Recent ${scoreSaberID} page:${pageOfScoreSaber}` }, async () => fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/scores/recent/${pageOfScoreSaber}`)
            .then(res => res.json())
            .catch(err => { throw new Error("Failed api request: " + err) }));
        console.log(`Page: ${pageOfScoreSaber}`);

        executions++;
        if (executions === 3) console.log(`Failed multiple times to get scores from ${scoreSaberID} page: ${pageOfScoreSaber}.`)
        else {
            for (let i = 0; i < res.scores?.length; i++) {

                if (res.scores[i].timeSet == dbresLatestScore[0].date) {
                    foundSeenPlay = true;
                    break;
                }
                else {
                    await AddPlayToDb(res.scores[i], db, scoreSaberID);
                }
            }
        }
        pageOfScoreSaber++;
    }
    console.log(`Reached end of unseen plays for ${scoreSaberID} from recent.`);
}

async function getTopScoresFromScoreSaber(scoreSaberID, db) {
    let reachedEndOfRanked = false;
    let pageOfScoreSaber = 1;

    while (!reachedEndOfRanked) {
        let executions = 0;
        let res = await limiter.schedule({ id: `Top ${scoreSaberID} page:${pageOfScoreSaber}` }, async () => fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/scores/top/${pageOfScoreSaber}`)
            .then(res => res.json())
            .catch(err => { throw new Error("Failed api request: " + err) }));
        console.log(`Page: ${pageOfScoreSaber}`);

        executions++;
        if (executions === 3) console.log(`Failed multiple times to get scores from ${scoreSaberID} page: ${pageOfScoreSaber}.`)
        else {
            for (let i = 0; i < res.scores?.length; i++) {
                if (res.scores[i].pp === 0) {
                    reachedEndOfRanked = true;
                }
                else {
                    await AddPlayToDb(res.scores[i], db, scoreSaberID);
                }
            }
        }
        pageOfScoreSaber++;
    }
    console.log(`Reached end of ranked for ${scoreSaberID}`);
}

async function AddPlayToDb(playData, db, scoreSaberID) {
    const isRanked = (playData.pp > 0)

    const play = {
        leaderboardId: playData.leaderboardId,
        score: playData.score,
        hash: playData.songHash,
        maxscore: playData.maxScore,
        player: scoreSaberID,
        diff: playData.difficultyRaw,
        date: playData.timeSet,
        ranked: isRanked,
        pp: playData.pp,
        gained: false
    }

    const query = { hash: playData.songHash, player: scoreSaberID, diff: playData.difficultyRaw };

    await db.collection("discordRankBotScores").updateOne(
        { query },
        { $set: play },
        { upsert: true }
    )
}

async function getBeatSaverMapDataGithub(db) {
    console.log("Pulling scraped BeatSaver data from github.")

    let githubData = await fetch(`https://api.github.com/repos/andruzzzhka/BeatSaberScrappedData/contents`)
        .then(res => res.json())
        .catch(err => { console.log(`${err}`) })

    const sha = githubData[0].sha;

    const data = await fetch(`https://api.github.com/repos/andruzzzhka/BeatSaberScrappedData/git/blobs/${sha}`, {
        headers: {
            Accept: "application/vnd.github.v3+json"
        }
    })
        .then(res => res.json())
        .catch(err => console.log(err))

    const json = JSON.parse(atob(data.content));

    for (let i = 0; i < json.length; i++) {
        delete json[i]._id;
        json[i].hash = json[i].hash.toUpperCase();

        await db.collection("beatSaverLocal").updateOne(
            { hash: json[i].hash },
            { $set: json[i] },
            { upsert: true }
        )
    }

    db.collection("beatSaverLocal").createIndex({ hash: 1, key: 1 }, function (err, result) {
        if (err) console.log(err);
    });

    console.log("Done pulling & inserting scraped BeatSaver data from github.")
}

async function getBeatSaverMapData(hash) {
    console.log("Getting data from BeatSaver instead of DB.");
    let mapData;
    try {
        mapData = await BeatSaverLimiter.schedule(async () => fetch(`https://beatsaver.com/api/maps/by-hash/${hash}`, options)
            .then(res => res.json())
            .catch(err => console.log(err)))
        return [mapData];
    }
    catch (err) {
        console.log("Failed to get map data.\nData: " + mapData + "Error: " + err);
        return null;
    }

}

async function getUserFromScoreSaber(scoreSaberID) {
    try {
        let executions = 0;
        let user = await limiter.schedule({ id: `Userpage ${scoreSaberID} ` }, async () => fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/full`)
            .then(res => res.json())
            .catch(err => { throw new Error("Failed api request: " + err) }));

        executions++;

        if (executions === 2) {
            console.log(`Failed multiple times to get scores from ${scoreSaberID} page: ${pageOfScoreSaber}.`);
            return null;
        }
        else return user;
    }
    catch (err) {
        console.log(`Had an error: ${err} with scID:${scoreSaberID}`);
        return null
    }
}

async function UpdateAllRoles(db) {
    const dbres = await db.collection("discordRankBotUsers").find({ "country": config.country }).toArray();
    console.log(`${dbres.length} users to update.`);

    let responses = [];
    for (let i = 0; i < dbres.length; i++) {
        const user = await getUserFromScoreSaber(dbres[i].scId);

        responses.push(user);
    }

    const Gid = config.guildId;

    const guild = await client.guilds.fetch(Gid);
    for (let i = 0; i < dbres.length; i++) {
        try {
            const member = await guild.members.fetch({ user: dbres[i].discId, force: true });
            if (!member) {
                console.log(`Database contained user ${dbres[i].discName} [${dbres[i].discId}] that could not be updated`);
                console.log(dbres[i]);
                continue;
            }

            let playerRank = responses[i].playerInfo.countryRank;
            let memberRoles = member.roles.cache.array().filter(role => !role.name.startsWith("Top"));

            if (responses[i].playerInfo.countryRank === 0) playerRank = -1;

            if (!playerRank) {
                console.log(`There was an error with this user, most likely an API error, user: ${dbres[i].discName} sc:${dbres[i].scId}`)
                continue
            }

            let inactive = false;
            let addRole = null;

            if (playerRank === -1) {
                console.log(`${dbres[i].discName} seems to be inactive according to scoresaber, removing Top role.`);
                inactive = true;
            }
            else if (playerRank <= 5) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 5").first();
            }
            else if (playerRank <= 10) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 10").first();
            }
            else if (playerRank <= 15) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 15").first();
            }
            else if (playerRank <= 20) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 20").first();
            }
            else if (playerRank <= 25) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 25").first();
            }
            else if (playerRank <= 50) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 50").first();
            }
            else if (playerRank > 50) {
                addRole = guild.roles.cache.filter(role => role.name === "Top 50+").first();
            }

            if (!inactive) {
                console.log(`Adding role ${addRole.name} to user ${dbres[i].discName}.`);
                memberRoles.push(addRole);
            }
            member.roles.set(memberRoles);
        }

        catch (err) {
            console.log(`Failed to automaticly update role for user: ${dbres[i].discName}. Reason: ${err}, scID: ${dbres[i].scId}`);
            continue;
        }
    };
}

async function findMapByHash(hash, db) {
    let map = await db.collection("beatSaverLocal").find({ hash: hash.toUpperCase() }).toArray();
    if (map.length === 0) {
        console.log("Hash: " + hash)
        try {
            map = await getBeatSaverMapData(hash);
            if (map == null) return [];
        }
        catch (err) {
            console.log(err);
            return [];
        }
    }
    return map;
}

async function createPlaylist(playlistName, songs) {
    const playlist = {
        playlistTitle: playlistName,
        playlistAuthor: "RankBot",
        playlistDescription: "",
        image: "",
        songs: songs
    }

    const playlistString = JSON.stringify(playlist, null, 2);
    const playlistBuffer = Buffer.from(playlistString, "utf-8");

    return new Discord.MessageAttachment(playlistBuffer, `${playlistName}.json`);
}

//https://discordjs.guide/miscellaneous/parsing-mention-arguments.html#using-regular-expressions
async function getUserFromMention(mention) {
    // The id is the first and only match found by the RegEx.
    const matches = mention.match(/^<@!?(\d+)>$/);

    // If supplied variable was not a mention, matches will be null instead of an array.
    if (!matches) return;

    // However the first element in the matches array will be the entire mention, not just the ID,
    // so use index 1.
    const id = matches[1];

    return client.users.cache.get(id);
}

async function calculateTime(ms) {
    let timeArray = [];
    //Milliseconds to seconds
    let delta = Math.abs((Date.now() - ms) / 1000);

    //Whole days
    const days = { amount: Math.floor(delta / 86400), scale: "day" };
    timeArray.push(days);
    delta -= days.amount * 86400;

    //Whole hours
    const hours = { amount: Math.floor(delta / 3600), scale: "hour" };
    timeArray.push(hours);
    delta -= hours.amount * 3600;

    //Whole minutes
    const minutes = { amount: Math.floor(delta / 60), scale: "minute" };
    timeArray.push(minutes);
    delta -= minutes.amount * 60;

    //Seconds
    const seconds = { amount: Math.round(delta), scale: "second" };
    timeArray.push(seconds);

    return twoHighestTimeScales(timeArray);
}

function twoHighestTimeScales(timeArray) {
    let string = "";
    let valuesFound = 0;
    for (let i = 0; i < timeArray.length; i++) {
        if (timeArray[i].amount !== 0) {
            if (valuesFound === 1) string = string + " ";
            if (timeArray[i].amount > 1) timeArray[i].scale = timeArray[i].scale + "s";
            string = string + timeArray[i].amount + " " + timeArray[i].scale;
            valuesFound++;
        }
        if (valuesFound === 2) break;
        //else string = string + " ";
    }
    return string;
}

function removeOtherRankRoles(message) {
    const msgMembRole = message.member.roles;
    if (msgMembRole.cache.some(role => role.name.startsWith(`Top`))) {
        const removableRole = msgMembRole.cache.find(role => role.name.startsWith(`Top`));
        msgMembRole.remove(removableRole, [`automatic removal of rank role`])
            .then(console.log(`Removed role: ${removableRole.name} from user ${message.author.username}`))
            .catch(console.error);
    }
}

function calculateMaxScore(notes) {
    let mapTotalScore = 0;
    let hits = 0;

    while (notes !== 0) {
        if (hits <= 2) mapTotalScore = mapTotalScore + +115;
        else if (hits < 6) mapTotalScore = mapTotalScore + +115 * 2;
        else if (hits < 12) mapTotalScore = mapTotalScore + +115 * 4;
        else mapTotalScore = mapTotalScore + +115 * 8;
        hits++;
        notes--;
    }
    return mapTotalScore;
}

let automaticUpdatesOnOff;

function toggleUpdates(message, db) {
    if (!automaticUpdatesOnOff) {
        automaticUpdatesOnOff = setInterval(() => { updates(message, db) }, 1000 * 60);
    } else {
        clearInterval(automaticUpdatesOnOff);
        statusOff();
        automaticUpdatesOnOff = null;
    }
}

let TimeRemainingHours = config.updateIntervalHours;
let TimeRemainingMinutes = 0;

async function updates(message, db) {
    if (TimeRemainingHours === 0 && TimeRemainingMinutes === 0) {
        TimeRemainingHours = config.updateIntervalHours - 1;
        TimeRemainingMinutes = 59;
        await message.channel.send("Started an automatic role update");
        console.log(`Updating rank roles.`);
        await UpdateAllRoles(db);
        await message.channel.send("Finished.");
        console.log(`Completed role updates.`);

    }
    else if (TimeRemainingMinutes === 0) {
        TimeRemainingHours--;
        TimeRemainingMinutes = 59;
    }
    else TimeRemainingMinutes--;
    client.user.setActivity(`Next update in ${TimeRemainingHours}:${TimeRemainingMinutes.toString().padStart(2, '0')}`);
}

async function commandHandler(db) {
    client.on('message', async (message) => {
        if (!message.content.startsWith(prefix) || message.author.bot) return;
        if (message.channel.type === "dm") {
            message.channel.send("Sorry this bot does not take commands in DMs");
            return;
        }

        const args = message.content.slice(prefix.length).trim().split(' ');
        const command = args.shift().toLowerCase();

        if (command === 'test') {
            message.channel.send("Haha yes nice test :)");
        };

        if (command === 'tourney') {
            let role = message.guild.roles.cache.filter(role => role.name === "Turnausilmoitukset").first();
            if (role === undefined) {
                console.log(`Role Turanausilmotukset did not exist. Creating...`);

                await message.guild.roles.create({
                    data: {
                        name: "Turnausilmoitukset"
                    }
                }).catch(err => console.error(`Failed to create role Turnausilmoitukset`, err));

                role = message.guild.roles.cache.filter(role => role.name === "Turnausilmoitukset").first();
            }
            await message.member.roles.add(role);
            message.channel.send("You now have tourney role, prepare to be pinged on tourney stuff.\nMessage an admin if you want this removed.");
        }

        if (command === 'maxscore') {
            if (checkIfOwner(message)) {
                message.channel.send(calculateMaxScore(args[0]));
            }
        }

        if (command === 'rankedhashes') {
            return;
            let maps = await db.collection("scoresaberRankedMaps").find().toArray();

            //let string = "Maps: ";

            let object = [];

            for (let i = 0; i < maps.length; i++) {
                let map = { hash: maps[i].hash, stars: maps[i].stars, diff: maps[i].diff }
                object.push(map);
            }

            //const stringBuffer = Buffer.from(string, "utf-8");
            //let file = new Discord.MessageAttachment(stringBuffer, `maps.txt`);

            const playlistString = JSON.stringify(object, null, 2);
            const playlistBuffer = Buffer.from(playlistString, "utf-8");

            let file = new Discord.MessageAttachment(playlistBuffer, `maps.json`);

            message.channel.send("hahayes", file);
        }

        if (command === 'leaderboard') {
            return;
            if (!isNaN(args[0])) {
                const scores = await db.collection("discordRankBotScores").find({ leaderboardId: parseInt(args[0], 10) }).toArray();
                if (scores.length === 0) {
                    message.channel.send("No scores found on that leaderboard");
                    return;
                }
                else {
                    const map = await findMapByHash(scores[0].hash, db);

                    if (map === undefined) {
                        message.channel.send("Failed to find map, make sure it is not deleted from beatsaver...")
                        return;
                    }

                    scores.sort(function (a, b) {
                        return b.score - a.score;
                    });

                    const embed = new Discord.MessageEmbed()
                        .setAuthor(`${map[0].metadata.songName} ${map[0].metadata.songSubName} - ${map[0].metadata.songAuthorName}`, `https://new.scoresaber.com/apple-touch-icon.46c6173b.png`, `https://scoresaber.com/leaderboard/${args[0]}`)
                        .setThumbnail(`https://beatsaver.com${map[0].coverURL}`)
                        .addField(`Mapper`, `${map[0].metadata.levelAuthorName}`, true)
                        .addField(`Difficulty`, `${convertDiffNameVisual(scores[0].diff)}`, true)
                        .setTimestamp()
                        .setFooter(`Remember to hydrate`);

                    for (let i = 0; i < scores.length; i++) {
                        let playerName;
                        let player = await db.collection("discordRankBotUsers").find({ scId: scores[i].player }).toArray();
                        if (player.length === 0) {
                            player = await getUserFromScoreSaber(scores[i].player);
                            playerName = player.playerInfo.playerName;
                        }
                        else {
                            playerName = player[0].discName;
                        }
                        embed.addField(`${i + 1}. ${playerName}`, ` ${new Intl.NumberFormat('fi-FI').format(scores[i].score)} - ${Math.round((scores[i].score / scores[i].maxscore) * 10000) / 100}%`);
                    }

                    const key = map[0].key;
                    embed.addField(`\u200b`, `[Download](https://beatsaver.com${map[0].downloadURL}) | [BeatSaver](https://beatsaver.com/beatmap/${key}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${key})`);

                    message.channel.send(embed);
                }
            }
            else message.channel.send("That was not a number >:(");
        };

        if (command === 'hmd') {
            let listOfHMD = ["CV1", "Quest_1", "Quest_2", "Rift_S", "Vive", "Index", "WMR", "Cosmos", "Reverb_G2"];
            if (args[0]?.toLowerCase() === `help` || !args[0]) {
                let string = "\n";
                for (let i = 0; i < listOfHMD.length; i++) {
                    string = string + listOfHMD[i] + "\n"
                }
                message.channel.send("Here is a list of available HMD" + string);
                return;
            }

            let foundHMD = 0;
            let noFoundHMD = [];
            for (let i = 0; i < args.length; i++) {
                if (listOfHMD.map(x => x.toLowerCase()).includes(args[i].toLowerCase())) {
                    foundHMD++;
                    let hmdNameIndex = listOfHMD.map(x => x.toLowerCase()).findIndex(element => element === args[i].toLowerCase());
                    let role = message.guild.roles.cache.filter(role => role.name === listOfHMD[hmdNameIndex]).first();
                    if (role === undefined) {
                        console.log(`Role ${listOfHMD[hmdNameIndex]} did not exist. Creating...`);

                        await message.guild.roles.create({
                            data: {
                                name: listOfHMD[hmdNameIndex]
                            }
                        }).catch(err => console.error(`Failed to create role ${listOfHMD[hmdNameIndex]}`, err));

                        role = message.guild.roles.cache.filter(role => role.name === listOfHMD[hmdNameIndex]).first();
                    }
                    await message.member.roles.add(role);
                }
                else {
                    noFoundHMD.push(args[i]);
                }
            }
            if (noFoundHMD.length > 0) {
                let string = "\n";
                for (let i = 0; i < noFoundHMD.length; i++) {
                    string = string + noFoundHMD[i] + "\n"
                }
                message.channel.send(`Could not add these HMDs to you, try using \`${prefix}hmd help\` command for help.` + string);
            }
            if (foundHMD > 0) message.channel.send("Added some roles to you.");
        };

        if (command === 'gains') {
            return;
            async function updateUserInfo(scProfile) {
                await db.collection("discordRankBotUsers").updateOne({ discId: message.author.id }, { $set: { discName: message.author.username, pp: scProfile.playerInfo.pp, gainsDate: Date.now(), rank: scProfile.playerInfo.rank, countryRank: scProfile.playerInfo.countryRank, followed: true } });
            }

            let user = await db.collection("discordRankBotUsers").find({ discId: message.author.id }).toArray();
            if (user.length > 0) {
                let scoresFromUser = await db.collection("discordRankBotScores").find({ player: user[0].scId, gained: true }).count();
                console.log(scoresFromUser);
                if (scoresFromUser > 0) {
                    await getRecentScoresFromScoreSaber(user[0].scId, db);
                    const newScores = await db.collection("discordRankBotScores").find({ player: user[0].scId, gained: false }).toArray();

                    let erroredMaps = 0;
                    let totalLength = 0;
                    let totalNotes = 0;
                    let totalScore = 0;
                    let totalMaxScore = 0;

                    for (let i = 0; i < newScores.length; i++) {
                        let map;
                        let mapErrored = false;

                        try { map = await findMapByHash(newScores[i].hash, db); }
                        catch (err) {
                            console.log("Map errored:\n" + err + "Hash: " + newScores[i].hash)
                            mapErrored = true;
                        };
                        if (map[0] === undefined) {
                            mapErrored = true;
                            erroredMaps++;
                        }

                        if (!mapErrored) {
                            let difficultyData = [];

                            for (let j = 0; j < map[0].metadata.characteristics.length; j++) {
                                const difficultyInfo = map[0].metadata.characteristics[j];
                                if (difficultyInfo.name === 'Standard') difficultyData = difficultyInfo.difficulties;
                            }

                            const thisDiffData = difficultyData[convertDiffNameBeatSaver(newScores[i].diff)]
                            let mapTotalNotes = thisDiffData.notes;

                            totalNotes = totalNotes + +mapTotalNotes;

                            if (newScores[i].maxscore === 0) {
                                console.log(`Maxscore was 0 for ${newScores[i].leaderboardId}.`);

                                let mapScores = await db.collection("beatSaverLocal").find({ leaderboardId: newScores[i].leaderboardId, maxscore: { $gt: 1 } }).toArray();

                                if (mapScores.length === 0) {
                                    let mapTotalScore = 0;
                                    let hits = 0;

                                    while (mapTotalNotes !== 0) {
                                        if (hits <= 2) mapTotalScore = mapTotalScore + +115;
                                        else if (hits < 6) mapTotalScore = mapTotalScore + +115 * 2;
                                        else if (hits < 12) mapTotalScore = mapTotalScore + +115 * 4;
                                        else mapTotalScore = mapTotalScore + +115 * 8;
                                        hits++;
                                        mapTotalNotes--;
                                    }
                                    totalMaxScore = totalMaxScore + +mapTotalScore;
                                    db.collection("discordRankBotScores").updateMany({ leaderboardId: newScores[i].leaderboardId }, { $set: { maxscore: totalScore } });
                                }
                                else {
                                    totalMaxScore = totalMaxScore + +mapScores[0].maxscore
                                }
                            }
                            else totalMaxScore = totalMaxScore + +newScores[i].maxscore;

                            totalLength = totalLength + +thisDiffData.length;
                            totalScore = totalScore + +newScores[i].score;
                        }
                    }

                    const scProfile = await getUserFromScoreSaber(user[0].scId);

                    await updateUserInfo(scProfile);

                    const ppGained = Math.round((scProfile.playerInfo.pp - user[0].pp) * 100) / 100;
                    const rankChange = user[0].rank - scProfile.playerInfo.rank;
                    const countryRankChange = user[0].countryRank - scProfile.playerInfo.countryRank;

                    const lengthString = new Date(totalLength * 1000).toISOString().substr(11, 8);
                    const averageNPS = Math.round(totalNotes / totalLength * 100) / 100;
                    const averageAccuracy = Math.round(totalScore / totalMaxScore * 10000) / 100 + "%";

                    const time = await calculateTime(user[0].gainsDate);

                    function Emote(val1, val2) {
                        if (val1 > val2) return message.guild.emojis.cache.find(emoji => emoji.name === "small_green_triangle_up");
                        if (val1 === val2) return ":small_blue_diamond:";
                        else return ":small_red_triangle_down:";
                    }

                    const embed = new Discord.MessageEmbed()
                        .setTitle(`Your gains`)
                        .setThumbnail(`https://new.scoresaber.com${scProfile.playerInfo.avatar}`)
                        .addField(`Rank`, `${rankChange} ${Emote(user[0].rank, scProfile.playerInfo.rank)} ${scProfile.playerInfo.rank}`)
                        .addField(`PP`, `${ppGained} ${Emote(scProfile.playerInfo.pp, user[0].pp)} ${scProfile.playerInfo.pp}`)
                        .addField(`Country :flag_${scProfile.playerInfo.country.toLowerCase()}:`, `${countryRankChange} ${Emote(user[0].countryRank, scProfile.playerInfo.countryRank)} ${scProfile.playerInfo.countryRank}`)
                        //.addField(`In the last`, `${time}.`)
                        .setFooter(`In the last ${time}.`)

                    if (newScores.length > 0) {
                        embed.addField(`Playinfo`, `You played ${newScores.length} maps. \nDuration: ${lengthString}.`);
                        embed.addField(`Averages`, `NPS: ${averageNPS} | Acc: ${averageAccuracy}`);
                    }
                    else {
                        embed.addField(`Playinfo`, `No maps played.`)
                    }
                    if (erroredMaps > 0) {
                        embed.addField(`Errored map count`, `${erroredMaps}.\nThis will falsify your accuracy among other things.`)
                    }
                    message.channel.send(embed);

                }
                else {
                    message.channel.send("Setting up your gains for the first time, this will take a while depending on your playcount.\nYou will be pinged once done.");
                    await getAllScoresFromScoreSaber(user[0].scId, db);

                    const scProfile = await getUserFromScoreSaber(user[0].scId);

                    await updateUserInfo(scProfile);

                    message.channel.send(`${message.author} you are now setup to use gains command in the future.`);
                }
                db.collection("discordRankBotScores").updateMany({ player: user[0].scId, gained: false }, { $set: { gained: true } })
            }
            else message.channel.send(`You might not be registered, try doing ${prefix}addme command first.`);
        };

        if (command === 'playlistinfo') {
            const attachmentURL = message.attachments.array()[0].attachment;
            if (attachmentURL.endsWith(".json") || attachmentURL.endsWith(".bplist")) {
                let data;
                try {
                    data = await fetch(`${attachmentURL}`).then(res => res.json());
                }
                catch (err) {
                    message.channel.send("Something went wrong downloading the playlist.")
                    console.log(err)
                }

                let mapInfo = "Playlistdata:\n";
                for (let i = 0; i < data.songs.length; i++) {
                    let mapHash = data.songs[i].hash;

                    let result = await findMapByHash(mapHash, db);
                    result = result[0];

                    if (!result) {
                        mapInfo = mapInfo + (`Could not find map ${data.songs[i].hash}`)
                    }
                    else {
                        mapInfo = mapInfo + (`${result.metadata.songName} ${result.metadata.songSubName} - ${result.metadata.songAuthorName} by ${result.metadata.levelAuthorName}\nKey: ${result.key} | BPM: ${result.metadata.bpm}`);
                        if (data.songs[i]?.difficulties !== undefined) {
                            let difficultyData = [];

                            for (let i = 0; i < result.metadata.characteristics.length; i++) {
                                const difficultyInfo = result.metadata.characteristics[i];
                                if (difficultyInfo.name === data.songs[i].difficulties[0].characteristic) difficultyData = difficultyInfo.difficulties;
                            }

                            const thisDiffData = difficultyData[convertDiffNameBeatSaver(data.songs[i].difficulties[0].name)];

                            mapInfo = mapInfo + ` | NJS: ${thisDiffData.njs} | NPS: ${Math.round(thisDiffData.notes / thisDiffData.length * 100) / 100} | ${data.songs[i].difficulties[0].characteristic}-${data.songs[i].difficulties[0].name}`
                        }
                        mapInfo = mapInfo + `\n-=-\n`;
                    }
                }
                const mapInfoBuffer = Buffer.from(mapInfo, "utf-8");
                const mapInfoAttachment = new Discord.MessageAttachment(mapInfoBuffer, `Playlist_${data.playlistTitle}_Info.txt`);

                message.channel.send("Here is your info :)", mapInfoAttachment);
            }
            else {
                message.channel.send("This is not a valid playlist data type. Supported types: json, bplist")
            }

        };

        if (command === 'rankedlist') {
            return;
            const maps = await db.collection("scoresaberRankedMaps").find({}).toArray();

            let hashlist = [];
            for (let i = 0; i < maps.length; i++) {
                const mapHash = { hash: maps[i].hash }
                if (!hashlist.some(e => e.hash === maps[i].hash)) hashlist.push(mapHash);

            }

            let playlistAttatchment = await createPlaylist("Ranked", hashlist);
            message.channel.send("Here is your playlist with all ranked maps.", playlistAttatchment);
        };

        if (command === 'randombsr') {
            const result = await db.collection("beatSaverLocal").aggregate([{ $sample: { size: 1 } }]).toArray();

            const embed = new Discord.MessageEmbed()
                .addField(`\u200b`, `||${result[0].metadata.songName} ${result[0].metadata.songSubName} by ${result[0].metadata.levelAuthorName}||`)
                .addField(`\u200b`, `\`!bsr ${result[0].key}\``)

            message.channel.send(embed);
        };

        if (command === 'randomplaylist') {
            if (Number.isInteger(args[0]) || args[0] > 0) {
                let amount = parseInt(args[0]);

                const results = await db.collection("beatSaverLocal").aggregate([{ $sample: { size: amount } }]).toArray();

                let mapHashes = [];
                for (let i = 0; i < results.length; i++) {
                    const songhash = { hash: results[i].hash }
                    mapHashes.push(songhash)
                }
                const playlistAttachment = await createPlaylist("RandomPlaylist", mapHashes)
                await message.channel.send(`${message.author}, here is your random playlist. :)`, playlistAttachment);
            }
            else {
                message.channel.send("That is not a valid amount maps for a playlist.");
            }

        };

        if (command === 'forcesaverdata') {
            if (checkIfOwner(message)) {
                await getBeatSaverMapDataGithub(db);
                message.channel.send("Done")
            }
        };

        if (command === 'snipelist') {
            message.channel.send("No working :)")
            return;
            if (checkIfOwner(message)) {
                message.channel.send("Gathering and comparing scores, this might take a moment.")

                const dbres = await db.collection("discordRankBotUsers").findOne({ discId: message.author.id }, { scId: 1 });
                if (!dbres) {
                    message.channel.send("You are not registered.")
                }
                else {
                    const userId = dbres.scId

                    const userScoresCount = await db.collection("discordRankBotScores").find({ player: userId, ranked: true }).count();
                    if (userScoresCount === 0) await getTopScoresFromScoreSaber(userId, db);
                    else await getRecentScoresFromScoreSaber(userId, db);

                    const otherScoresCount = await db.collection("discordRankBotScores").find({ player: args[0], ranked: true }).count();
                    if (otherScoresCount === 0) await getTopScoresFromScoreSaber(args[0], db)
                    else await getRecentScoresFromScoreSaber(args[0], db)

                    let otherScores = await db.collection("discordRankBotScores").find({ player: args[0], ranked: true }).toArray();

                    let mapHashes = [];
                    for (let i = 0; i < otherScores.length; i++) {
                        let play = await db.collection("discordRankBotScores").findOne({ player: userId, leaderboardId: otherScores[i].leaderboardId });
                        const songhash = { hash: otherScores[i].hash }
                        if (play && play.score < otherScores[i].score) mapHashes.push(songhash);
                        else if (!play) mapHashes.push(songhash);
                    }

                    const playlistAttachment = await createPlaylist(`${dbres.discName}-vs-${args[0]}`, mapHashes)
                    await message.channel.send(`${message.author}, here is your playlist. Get sniping.`, playlistAttachment);
                }
            }
        };

        if (command === 'guest') {
            function DMuser() {
                try {
                    message.author.send("You have successfully registered to the Finnish Beat Saber community discord. \nRemember to check the rules in the #info-etc channel and for further bot interaction go to #botstuff and enjoy your stay.")

                }
                catch (err) {
                    console.log("Could not dm user" + err)
                }
            }

            if (message.member.roles.cache.some(role => role.name === 'landed')) {
                let addRole = message.guild.roles.cache.find(role => role.name === "Guest");
                message.member.roles.set([addRole])
                    .then(DMuser())
                    .catch(console.log);
            }
        };

        if (command === 'followuser') {
            if (checkIfOwner(message)) {
                await db.collection("followedUsers").insertOne({ scId: args[0] });
            }
        };

        if (command === 'checkfollowed') {
            message.channel.send("no")
            return;
            if (checkIfOwner(message)) {
                let users = await db.collection("followedUsers").find().toArray();

                for (let i = 0; i < users.length; i++) {

                    await getRecentScoresFromScoreSaber(users[i].scId, db);

                    let scoreCount = await db.collection("discordRankBotScores").find({ player: users[i].scId }).count();
                    let userData = await getUserFromScoreSaber(users[i].scId);

                    if (scoreCount > 0) {
                        console.log("Local: " + scoreCount + " SC: " + userData.scoreStats.totalPlayCount)
                        if (scoreCount < userData.scoreStats.totalPlayCount) {
                            await getAllScoresFromScoreSaber(users[i].scId, db);
                        }
                    }
                }
            }
        };

        if (command === 'allscores') {
            if (checkIfOwner(message)) {
                await getAllScoresFromScoreSaber(args[0], db);
            }
        };

        if (command === 'getrecentscores') {
            if (checkIfOwner(message)) {
                await getRecentScoresFromScoreSaber(args[0], db);
                message.channel.send("Got some recent scores.")
            }

        };

        if (command === 'gettopscores') {
            if (checkIfOwner(message)) {
                const query = { scId: args[0] }
                let dbres = await db.collection("discordRankBotUsers").find(query).toArray();
                let userName;

                console.log(dbres)

                if (dbres.length === 1) userName = dbres[0].discName;
                else {
                    const userData = await getUserFromScoreSaber(args[0]);
                    userName = userData.playerInfo.playerName
                }

                message.channel.send(`Getting scores for ${userName}.`)

                await getTopScoresFromScoreSaber(args[0], db);
                message.channel.send(`Got top scores for ${userName}.`)
            }
        };

        if (command === 'getranked') {
            if (checkIfOwner(message)) {
                console.log(`Requesting ranked maps.`)

                let maps = await fetch(`https://scoresaber.com/api.php?function=get-leaderboards&page=1&limit=${args[0]}&ranked={ranked_only}`)
                    .then(res => res.json())
                    .catch(err => { console.log(`${err}`) })

                console.log(`Found: ${maps.songs.length} maps.`);

                let insertedMaps = 0;
                let existedMaps = 0;

                let scoresToPpCheck = [];
                let newMaps = [];

                for (let i = 0; i < maps.songs.length; i++) {
                    let map = maps.songs[i];
                    const query = { hash: map.id.toUpperCase(), diff: map.diff };
                    const dbres = await db.collection("scoresaberRankedMaps").find(query).toArray();

                    if (!dbres[0]) {
                        let rankedStatus = false;
                        if (map.ranked === 1) rankedStatus = true;
                        let object = {
                            hash: map.id.toUpperCase(),
                            name: map.name,
                            songAuthor: map.songAuthorName,
                            mapper: map.levelAuthorName,
                            bpm: map.bpm,
                            diff: map.diff,
                            stars: map.stars,
                            isRanked: rankedStatus
                        };
                        db.collection("scoresaberRankedMaps").insertOne(object, async function (err) {
                            if (err) throw err;

                            if (args[1] !== "nopost") {
                                const qualifiedPlays = await db.collection("discordRankBotScores").find({ hash: object.hash, diff: map.diff }).toArray();

                                for (let i = 0; i < qualifiedPlays.length; i++) {
                                    let play = { player: qualifiedPlays[i].player, leaderboardId: qualifiedPlays[i].leaderboardId }
                                    scoresToPpCheck.push(play);
                                }
                            }

                            await db.collection("discordRankBotScores").updateMany({ hash: object.hash }, { $set: { ranked: true } });

                            newMaps.push(map);
                            insertedMaps++;
                        })
                    }
                    else existedMaps++;
                }
                await message.channel.send(`New maps: ${insertedMaps}\nMaps already in db: ${existedMaps} \nFrom a total of ${maps.songs.length} maps.`)
                console.log(`New maps: ${insertedMaps}, Maps already in db: ${existedMaps}.`)

                let addedIDs = [];

                if (args[1] === "nopost") return
                else {
                    for (let i = 0; i < newMaps.length; i++) {
                        let map = []
                        if (!addedIDs.includes(newMaps[i].id)) {
                            for (let j = 0; j < newMaps.length; j++) {
                                if (newMaps[i].id === newMaps[j].id) {
                                    map.push(newMaps[j])
                                    addedIDs.push(newMaps[i].id);
                                }
                            }

                            map.sort(function (a, b) {
                                return b.stars - a.stars;
                            });

                            let mapData = await findMapByHash(map[0].id, db);
                            let difficultyData = [];

                            for (let i = 0; i < mapData[0].metadata.characteristics.length; i++) {
                                const difficultyInfo = mapData[0].metadata.characteristics[i];
                                if (difficultyInfo.name === 'Standard') difficultyData = difficultyInfo.difficulties;
                            }

                            const minutes = Math.floor(mapData[0].metadata.duration / 60);
                            const seconds = (mapData[0].metadata.duration - minutes * 60).toString().padStart(2, "0");

                            const embed = new Discord.MessageEmbed()
                                .setAuthor(`${map[0].name} ${map[0].songSubName} - ${map[0].songAuthorName}`, `https://new.scoresaber.com/apple-touch-icon.46c6173b.png`, `https://scoresaber.com/leaderboard/${map[0].uid}`)
                                .setThumbnail(`https://scoresaber.com${map[0].image}`)
                                .addField(`Mapper`, `${map[0].levelAuthorName}`)
                                .addFields(
                                    { name: `BPM`, value: `${map[0].bpm}`, inline: true },
                                    { name: `Length`, value: `${minutes}:${seconds}`, inline: true }
                                )
                                .setTimestamp()
                                .setFooter(`Remember to hydrate`);

                            for (let l = 0; l < map.length; l++) {
                                const thisDiffData = difficultyData[convertDiffNameBeatSaver(map[l].diff)]
                                const NPS = Math.round(thisDiffData.notes / thisDiffData.length * 100) / 100
                                embed.addField(`${convertDiffNameVisual(map[l].diff)}`, `**${map[l].stars}** :star: | NJS: **${thisDiffData.njs}** | NPS: **${NPS}**`);
                            }
                            const key = mapData[0].key;
                            embed.addField(`\u200b`, `[Download](https://beatsaver.com${mapData[0].downloadURL}) | [BeatSaver](https://beatsaver.com/beatmap/${key}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${key})`);
                            await message.channel.send(embed);
                        }
                    }
                }
                //Do pp find here from scoresToPpCheck
                let uniquePlayer = []
                // #1. Get list of players with scores
                for (let i = 0; i < scoresToPpCheck.length; i++) {
                    if (!(uniquePlayer.includes(scoresToPpCheck[i].player))) uniquePlayer.push(scoresToPpCheck[i].player)
                }

                // #2. Get recent from players with scores
                for (let i = 0; i < uniquePlayer.length; i++) {
                    await getRecentScoresFromScoreSaber(uniquePlayer[i], db);
                    let scores = await db.collection("discordRankBotScores").find({ player: uniquePlayer[i] }).sort({ date: -1 }).toArray();

                    // #3. Find player plays and go trough to find index
                    for (let j = 0; j < scores.length; j++) {
                        if (scores[j].leaderboardId === scoresToPpCheck[i].leaderboardId) scoresToPpCheck[i].index = j;
                    }
                }

                for (let i = 0; i < scoresToPpCheck.length; i++) {
                    scoresToPpCheck[i].page = Math.floor((scoresToPpCheck[i].index / 8) + 1)

                    getOnePageRecentFromScoreSaber(scoresToPPCheck[i].player, db, scoresToPPCheck[i].leaderboardId, scoresToPPCheck[i].page)
                }
            }
        };

        if (command === 'updateallcountry') {
            if (checkIfOwner(message)) {
                const dbres = await db.collection("discordRankBotUsers").find({}).toArray();
                for (let i = 0; i < dbres.length; i++) {
                    let user = await getUserFromScoreSaber(dbres[i].scId);
                    if (user) {
                        let query = { discId: dbres[i].discId };
                        let newvalue = { $set: { country: user.playerInfo.country } };

                        db.collection("discordRankBotUsers").updateOne(query, newvalue, function (err) {
                            if (err) console.log(err);
                            else console.log(`Updated country for user ${dbres[i].discName}`);
                        });
                    }
                    else {
                        console.log(`Could not update country for a user, scID:${dbres[i].scId} discName:${dbres[i].discName}`)
                        continue;
                    }
                }
                message.channel.send("Completed country updates.")
            }
        };

        if (command === 'emojiupload') {
            if (checkIfOwner(message)) {
                message.guild.emojis.create(`updooter2.png`, `small_green_triangle_up`).then(emoji => message.channel.send(`The following emoji was uploaded ${emoji}`));
            }
        };

        if (command === 'compare') {
            try {
                console.log("Starting a comparison")

                let usersToCheck = [];
                let users = [];

                const query = { discId: message.author.id };
                const dbres = await db.collection("discordRankBotUsers").find(query).toArray();

                if (dbres.length !== 0) {
                    usersToCheck.push(dbres[0].scId);
                    let user = await getUserFromMention(args[0]);

                    let usersFlipped = false;
                    let foundComparableUser = false;

                    if (user && user.bot) {
                        message.channel.send("Sorry bots dont play the game, unless your name is Taichi.");
                    }

                    else if (user && args[0]) {
                        const mentionedQuery = { discId: user.id };
                        const mentioneddbres = await db.collection("discordRankBotUsers").find(mentionedQuery).toArray();

                        if (mentioneddbres.length !== 0) {
                            usersToCheck.push(mentioneddbres[0].scId);
                            foundComparableUser = true;
                        }
                    }

                    else if (!args[0].includes("<")) {
                        let scuser = await getUserFromScoreSaber(args[0]);

                        if (scuser.playerInfo) {
                            console.log(`Added a user from args ${args[0]}`)
                            users.push(scuser);
                            foundComparableUser = true;
                        }

                        usersFlipped = true;
                    }

                    for (let i = 0; i < usersToCheck.length; i++) {
                        console.log(i + " : " + usersToCheck[i]);
                        let scuser = await getUserFromScoreSaber(usersToCheck[i]);
                        users.push(scuser);
                    }

                    if (usersFlipped) users = users.reverse();

                    if (foundComparableUser === false && !user.bot) {
                        message.channel.send("The pinged user does not seem to be registered.")
                    }

                    else if (users[0] && users[1] && users[0].playerInfo.playerId === users[1].playerInfo.playerId) {
                        message.channel.send("Stop trying to compare yourself to yourself...");
                    }
                    else if (users[0] && users[1] && users[0].playerInfo.playerId !== users[1].playerInfo.playerId) {
                        console.log(`Comparing users: ${users[0].playerInfo.playerName} and ${users[1].playerInfo.playerName}.`)

                        function Emote(val1, val2) {
                            if (val1 > val2) return message.guild.emojis.cache.find(emoji => emoji.name === "small_green_triangle_up");
                            else return ":small_red_triangle_down:";
                        }

                        function BiggerOrSmaller(val1, val2) {
                            if (val1 > val2) return `>`;
                            else return `<`;
                        }

                        let ppDifference = ((users[0].playerInfo.pp) - (users[1].playerInfo.pp)).toFixed(2);
                        let ppBiggerOrSmaller = BiggerOrSmaller(users[0].playerInfo.pp, users[1].playerInfo.pp);

                        let accDifference = ((users[0].scoreStats.averageRankedAccuracy) - (users[1].scoreStats.averageRankedAccuracy)).toFixed(2);
                        let accBiggerOrSmaller = BiggerOrSmaller(users[0].scoreStats.averageRankedAccuracy, users[1].scoreStats.averageRankedAccuracy);

                        let rankDifference = ((users[0].playerInfo.rank) - (users[1].playerInfo.rank));
                        let rankBiggerOrSmaller = BiggerOrSmaller(users[0].playerInfo.rank, users[1].playerInfo.rank);

                        const embed = new Discord.MessageEmbed()
                            .setAuthor(`Comparing`, `https://new.scoresaber.com${users[0].playerInfo.avatar}`, ``)
                            .setThumbnail(`https://new.scoresaber.com${users[1].playerInfo.avatar}`)
                            .setColor('#513dff')
                            .addField(`Users`, `[${users[0].playerInfo.playerName}](https://new.scoresaber.com/u/${usersToCheck[0]} 'Scoresaber - ${users[0].playerInfo.playerName}') - [${users[1].playerInfo.playerName}](https://new.scoresaber.com/u/${users[1].playerInfo.playerId} 'Scoresaber - ${users[1].playerInfo.playerName}')`)
                            .addFields(
                                {
                                    name: `PP`, value: `${Math.round((users[0].playerInfo.pp) * 100) / 100} ${ppBiggerOrSmaller} ${Math.round((users[1].playerInfo.pp) * 100) / 100} \n${Emote(users[0].playerInfo.pp, users[1].playerInfo.pp)}  **${Math.round((ppDifference) * 100) / 100}pp**`
                                },
                                {
                                    name: `Acc`, value: `${Math.round((users[0].scoreStats.averageRankedAccuracy) * 100) / 100}% ${accBiggerOrSmaller} ${Math.round((users[1].scoreStats.averageRankedAccuracy) * 100) / 100}% \n${Emote(users[0].scoreStats.averageRankedAccuracy, users[1].scoreStats.averageRankedAccuracy)}  **${Math.round((accDifference) * 100) / 100}%**`
                                },
                                {
                                    name: `Rank`, value: `${users[0].playerInfo.rank} ${rankBiggerOrSmaller} ${users[1].playerInfo.rank} \n${Emote(users[1].playerInfo.rank, users[0].playerInfo.rank)} **${rankDifference * -1}**`
                                }
                            )
                            .setTimestamp()
                            .setFooter(`Remember to hydrate`);

                        message.channel.send(embed);
                    }
                }
                else {
                    message.channel.send("You are propably not registered...")
                }
            }

            catch (err) {
                message.channel.send("Something went terribly wrong, either you fucked something up or scoresaber or something else might be down...");
                console.log(err);
            }
        };

        if (command === 'toggleupdates') {
            if (checkIfOwner(message)) {
                if (!automaticUpdatesOnOff) {
                    await message.channel.send(`Automatic updates are now on.`);
                }
                else {
                    await message.channel.send(`Automatic updates are now off.`);
                }
                toggleUpdates(message, db);
            }
        };

        if (command === 'updateallroles') {
            if (checkIfOwner(message)) {
                console.log(`Starting updates`);
                await message.channel.send(`Updating all registered user roles.`);
                try {
                    await UpdateAllRoles(db);
                    console.log(`Completed role updates.`);
                    await message.channel.send(`Finished.`);
                }
                catch (err) {
                    await message.channel.send(`Failed to update all roles, check your logs dumfus`);
                    console.log(err);
                }
            }
        };

        if (command === "me") {
            const query = { discId: message.author.id };
            db.collection("discordRankBotUsers").find(query).toArray(async function (err, dbres) {
                if (err) throw err;
                if (!dbres[0]?.scId) {
                    message.channel.send(`I'm sorry I could not find you in the database.\nTry using ${prefix}addme <scoresaberid> to get added into this awesome system.`);
                }
                else {
                    let user = await getUserFromScoreSaber(dbres[0].scId);

                    if (user) {
                        console.log(`${user.playerInfo.playerName} r:${user.playerInfo.countryRank}`);

                        const embed = new Discord.MessageEmbed()
                            .setColor('#513dff')
                            .setThumbnail(`https://new.scoresaber.com${user.playerInfo.avatar}`)
                            .addField('Profile', `[__${user.playerInfo.playerName}__](https://new.scoresaber.com/u/${dbres[0].scId})`)
                            .addField("Ranks", `:globe_with_meridians: #${user.playerInfo.rank} \u200b \u200b \u200b #${user.playerInfo.countryRank}`)
                            .addField(`Stats`, `${new Intl.NumberFormat('fi-FI').format(user.playerInfo.pp)}pp \u200b Acc: ${Math.round(user.scoreStats.averageRankedAccuracy * 100) / 100}%`)
                            .addFields(
                                { name: `Playcount`, value: `Total: ${user.scoreStats.totalPlayCount}`, inline: true },
                                { name: `\u200b`, value: `Ranked: ${user.scoreStats.rankedPlayCount}`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter(`Remember to hydrate`);

                        message.channel.send(embed)
                    }
                    else message.channel.send(`Seems like we ran into an error, you should try again later`);
                }
            })
        };

        if (command === "deleteme") {
            removeOtherRankRoles(message);
            const myquery = { discId: message.author.id };
            db.collection("discordRankBotUsers").find(myquery).toArray(function (err, dbres) {
                if (err) throw err;
                if (!dbres[0]?.discId) {
                    message.channel.send(`I dont think you are in the database...`);
                }
                else {
                    db.collection("discordRankBotUsers").deleteOne(myquery, function (err) {
                        if (err) throw err;
                        console.log(`${message.author.username} deleted from the database`);
                    })
                    message.channel.send("I removed your rankrole & deleted you from the database.");
                }
            })
        };

        if (command === "addme") {
            if (!args.length) {
                return message.channel.send(`Please use a scoresaber id... ${message.author}!`);
            }
            else if (args) {
                let id = args[0].replace(/\D/g, '');
                console.log(id)
                let user = await getUserFromScoreSaber(id);

                if (!user) {
                    message.channel.send("Something went terribly wrong, check your scoresaber id and try again.")
                    return
                }

                let myobj = { discId: message.author.id, scId: id, discName: message.author.username, country: user.playerInfo.country };
                let query = { discId: message.author.id };

                db.collection("discordRankBotUsers").find(query).toArray(function (err, dbres) {
                    if (err) throw err;
                    if (dbres?.length < 1) {
                        db.collection("discordRankBotUsers").insertOne(myobj, async function (err) {
                            if (err) throw err;
                            console.log(`inserted ${message.author.username} with sc ${user.playerInfo.playerName}`);

                            async function UserRegistered() {
                                try {
                                    await message.author.send("You have successfully registered to the Finnish Beat Saber community discord. \nRemember to check the rules in the #info-etc channel and for further bot interaction go to #botstuff and enjoy your stay.")
                                }
                                catch (err) {
                                    console.log("Could not dm user" + err)
                                }
                                await client.channels.cache.get(adminchannelID).send(`${message.author.username} registered. Country: ${user.playerInfo.country} \n<https://scoresaber.com/u/${id}>`)
                            }

                            if (user.playerInfo.country === config.country) {
                                if (message.member.roles.cache.some(role => role.name === 'landed')) {
                                    let addRole = message.guild.roles.cache.find(role => role.name === "Verified");
                                    await message.member.roles.set([addRole])
                                        .catch(console.log);
                                    UserRegistered();
                                }
                                else message.channel.send(`You have been added and your role will be set with the next update, or if you are impatient you can run ${prefix}roleme.`);
                            }
                            else {
                                if (message.member.roles.cache.some(role => role.name === 'landed')) {
                                    let addRole = message.guild.roles.cache.find(role => role.name === "Guest");
                                    await message.member.roles.set([addRole])
                                        .catch(console.log);
                                    UserRegistered();
                                }
                                else message.channel.send("You have been added but unfortunately you will not get a role based on your rank as its not supported for international players.");
                            }
                        });
                    }
                    else {
                        message.channel.send("You propably already exist in the database...");
                        console.log(`${message.author.username} tried to add themself to the db but alrdy existed.`);
                    }
                })
            }
        };

        if (command === "createroles") {
            if (checkIfOwner(message)) {
                const roleNames = [
                    "Top 50+",
                    "Top 50",
                    "Top 25",
                    "Top 20",
                    "Top 15",
                    "Top 10",
                    "Top 5",
                    "Inactive"
                ];

                for (let roleName of roleNames)
                    if (!message.guild.roles.cache.some(role => role.name == roleName));
                message.guild.roles.create({
                    data: {
                        name: roleName
                    }
                }).catch(err => console.error(`Failed to create role ${roleName}`, err));
            }
        };

        if (command === "roleme") {
            let query = { discId: message.author.id }
            db.collection("discordRankBotUsers").find(query).toArray(async function (err, dbres) {
                if (!dbres[0]?.scId) {
                    message.channel.send(`I'm sorry I could not find you in the database.`);
                }
                else {
                    if (err) throw err;
                    console.log(dbres[0].scId);
                    let user = await getUserFromScoreSaber(dbres[0].scId);

                    if (!user.playerInfo) {
                        message.channel.send("Something went terribly wrong, you can try again in a moment.");
                        console.log(`Tried to make an API call with id:${args[0]} but got the response ${user}`);
                        return
                    }

                    console.log(`Player: ${user.playerInfo.playerName} countryrank: ${user.playerInfo.countryRank}`);
                    const msgMembRole = message.member.roles;
                    try {
                        removeOtherRankRoles(message);
                        if (user.playerInfo.countryRank <= 5) {
                            const role = message.guild.roles.cache.find(role => role.name === "Top 5");
                            msgMembRole.add(role);
                        }
                        else if (user.playerInfo.countryRank <= 10) {
                            const role = message.guild.roles.cache.find(role => role.name === "Top 10");
                            msgMembRole.add(role);
                        }
                        else if (user.playerInfo.countryRank <= 15) {
                            const role = message.guild.roles.cache.find(role => role.name === "Top 15");
                            msgMembRole.add(role);
                        }
                        else if (user.playerInfo.countryRank <= 20) {
                            const role = message.guild.roles.cache.find(role => role.name === "Top 20");
                            msgMembRole.add(role);
                        }
                        else if (user.playerInfo.countryRank <= 25) {
                            const role = message.guild.roles.cache.find(role => role.name === "Top 25");
                            msgMembRole.add(role);
                        }
                        else if (user.playerInfo.countryRank <= 50) {
                            const role = message.guild.roles.cache.find(role => role.name === "Top 50");
                            msgMembRole.add(role);
                        }
                        else if (user.playerInfo.countryRank > 50) {
                            const role = message.guild.roles.cache.find(role => role.name === "Top 50+");
                            msgMembRole.add(role);
                        }
                        message.channel.send(`I added an approriate role for your rank.`)
                    }
                    catch {
                        message.channel.send("It seems I was unable to add a role approriate for your rank.")
                        console.log(err);
                    };
                }
            })
        };
    })
}