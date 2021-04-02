const config = require('./config.json')

const Discord = require('discord.js');
const client = new Discord.Client();
const prefix = config.prefix

const Bottleneck = require(`bottleneck`);
const fetch = require('node-fetch');

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const fs = require('fs');

const atob = require('atob');

const url = 'mongodb://localhost:27017';
const dbName = 'discordRankBot';

const adminchannelID = `767029317741051944`

const options = {
    headers: { 'User-Agent': "FinnishBSDiscordBot/1.0.0" }
}

const limiter = new Bottleneck({
    reservoir: 70,
    reservoirRefreshAmount: 70,
    reservoirRefreshInterval: 60 * 1000,

    //minTime: 75
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
    if (diffName === "_ExpertPlus_SoloStandard") return "expertPlus"
    else if (diffName === "_Expert_SoloStandard") return "expert"
    else if (diffName === "_Hard_SoloStandard") return "hard"
    else if (diffName === "_Normal_SoloStandard") return "normal"
    else return "easy"
}

async function statusOff() {
    await client.user.setActivity("Updates OFF");
}

function checkIfOwner(message) {
    if (message.author.id === message.guild.ownerID) return true;
    else message.channel.send(`Sorry you lack the permissions for this command.`);
}

async function getRecentScoresFromScoreSaber(scoreSaberID, db) {
    let foundSeenPlay = false;
    let pageOfScoreSaber = 1;
    let insertedSongs = 0;
    let updatedSongs = 0;

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
                    let type = await AddPlayToDb(res.scores[i], db, scoreSaberID);
                    if (type === "Updated") updatedSongs++;
                    else if (type === "Inserted") insertedSongs++;
                }
            }
        }
        pageOfScoreSaber++;
    }
    console.log(`Reached end of unseen plays for ${scoreSaberID}`);
    console.log(`Inserted: ${insertedSongs} new plays and ${updatedSongs} updated songs.`)
}

async function getTopScoresFromScoreSaber(scoreSaberID, db) {
    let reachedEndOfRanked = false;
    let pageOfScoreSaber = 1;
    let insertedSongs = 0;
    let updatedSongs = 0;

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
                    let type = await AddPlayToDb(res.scores[i], db, scoreSaberID);
                    if (type === "Updated") updatedSongs++;
                    else if (type === "Inserted") insertedSongs++;
                }
            }
        }
        pageOfScoreSaber++;
    }
    console.log(`Reached end of ranked for ${scoreSaberID}`);
    console.log(`Inserted: ${insertedSongs} new plays and ${updatedSongs} updated songs.`)
}

async function AddPlayToDb(playData, db, scoreSaberID) {
    const query = { hash: playData.songHash, player: scoreSaberID, diff: playData.difficultyRaw };
    const dbres = await db.collection("discordRankBotScores").find(query).toArray();

    let isRanked = false;
    if (playData.pp > 0) isRanked = true

    if (!dbres[0] || dbres[0].score < playData.score) {
        const play = {
            leaderboardId: playData.leaderboardId,
            score: playData.score,
            hash: playData.songHash,
            maxscore: playData.maxScore,
            player: scoreSaberID,
            diff: playData.difficultyRaw,
            date: playData.timeSet,
            ranked: isRanked
        }
        if (dbres[0] && dbres[0].score < playData.score) {
            db.collection("discordRankBotUsers").replaceOne(dbres[0], play, function (err) {
                if (err) console.log(err);
                return "Updated"
            });
        }
        else {
            db.collection("discordRankBotScores").insertOne(play, function (err) {
                if (err) console.log(err);
                return "Inserted"
            })
        }
    }
}

async function getBeatSaverMapDataGithub(db) {
    console.log("Pulling scraped BeatSaver data from github.")

    let githubData = await fetch(`https://api.github.com/repos/andruzzzhka/BeatSaberScrappedData/contents`)
        .then(res => res.json())
        .catch(err => { console.log(`${err}`) })

    const sha = githubData[0].sha;

    let data = await fetch(`https://api.github.com/repos/andruzzzhka/BeatSaberScrappedData/git/blobs/${sha}`, {
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
        await db.collection("beatSaverLocal").update({ hash: json[i].hash }, json[i], {
            upsert: true
        })
    }

    db.collection("beatSaverLocal").createIndex({ hash: 1, key: 1 }, function (err, result) {
        if (err) console.log(err);
    });

    console.log("Done pulling & inserting scraped BeatSaver data from github.")
}

async function getBeatSaverMapData(hash) {
    await BeatSaverLimiter.schedule(async () => fetch(`https://beatsaver.com/api/maps/by-hash/${hash}`)
        .then(res => res.json)
        .then(res => {
            console.log("Got data from BeatSaver instead of DB.");
            console.log(res);
            return res;
        }))
        .catch(err => console.log(err))
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
        let user = await getUserFromScoreSaber(dbres[i].scId);

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

function removeOtherRankRoles(message) {
    const msgMembRole = message.member.roles;
    if (msgMembRole.cache.some(role => role.name.startsWith(`Top`))) {
        const removableRole = msgMembRole.cache.find(role => role.name.startsWith(`Top`));
        msgMembRole.remove(removableRole, [`automatic removal of rank role`])
            .then(console.log(`Removed role: ${removableRole.name} from user ${message.author.username}`))
            .catch(console.error);
    }
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
            message.channel.send("Sorry this bot does not take commands in DMs")
            return
        }

        const args = message.content.slice(prefix.length).trim().split(' ');
        const command = args.shift().toLowerCase();

        if (command === 'test') {
            message.channel.send("Haha yes nice test :)");
        }

        if (command === 'forcesaverdata') {
            if (checkIfOwner(message)) {
                getBeatSaverMapDataGithub(db);
            }
        }

        if (command === 'snipelist') {
            if (checkIfOwner(message)) {
                message.channel.send("Gathering and comparing scores, this might take a moment.")

                let dbres = await db.collection("discordRankBotUsers").findOne({ discId: message.author.id }, { scId: 1 });
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

                    let playlist = {
                        playlistTitle: `${dbres.discName}-vs-${args[0]}`,
                        playlistAuthor: "RankBot",
                        playlistDescription: "",
                        image: "",
                        songs: []
                    }

                    for (let i = 0; i < otherScores.length; i++) {
                        let play = await db.collection("discordRankBotScores").findOne({ player: userId, leaderboardId: otherScores[i].leaderboardId });
                        const songhash = { hash: otherScores[i].hash }
                        if (play && play.score < otherScores[i].score) playlist.songs.push(songhash);
                        else if (!play) playlist.songs.push(songhash);
                    }

                    const playlistString = JSON.stringify(playlist);

                    fs.writeFile(`${dbres.discName}-vs-${args[0]}.json`, playlistString, (err) => {
                        if (err) console.log(err);
                        else console.log("Playlist created");
                    });

                    const attachment = new Discord.MessageAttachment(`${dbres.discName}-vs-${args[0]}.json`);

                    await message.channel.send(`${message.author}, here is your playlist.\nIt has ${playlist.songs.length} songs, get sniping.`, attachment);

                    try {
                        fs.unlinkSync(`${dbres.discName}-vs-${args[0]}.json`);
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }

        if (command === 'guest') {
            function DMuser() {
                message.author.send("You have successfully registered to the Finnish Beat Saber community discord. \nRemember to check the rules in the #info-etc channel and for further bot interaction go to #botstuff and enjoy your stay.")
            }

            if (message.member.roles.cache.some(role => role.name === 'landed')) {
                let addRole = message.guild.roles.cache.find(role => role.name === "Guest");
                message.member.roles.set([addRole])
                    .then(DMuser())
                    .catch(console.log);
            }
        }

        if (command === 'getrecentscores') {
            if (checkIfOwner(message)) {
                await getRecentScoresFromScoreSaber(args[0], db);
                message.channel.send("Got some recent scores.")
            }

        }

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
                console.log(userName);

                message.channel.send(`Getting scores for ${userName}.`)

                await getTopScoresFromScoreSaber(args[0], db);
                message.channel.send(`Got top scores for ${userName}.`)
            }

        }

        if (command === 'getranked') {
            if (checkIfOwner(message)) {
                console.log(`Requesting ranked maps.`)
                let maps = await fetch(`https://scoresaber.com/api.php?function=get-leaderboards&page=1&limit=${args[0]}&ranked={ranked_only}`)
                    .then(res => res.json())
                    .catch(err => { console.log(`${err}`) })

                console.log(`Found: ${maps.songs.length} maps.`);

                let insertedMaps = 0;
                let existedMaps = 0;

                let newMaps = [];

                for (let i = 0; i < maps.songs.length; i++) {
                    let map = maps.songs[i];
                    const query = { hash: map.id, diff: map.diff };
                    const dbres = await db.collection("scoresaberRankedMaps").find(query).toArray();
                    if (!dbres[0]) {
                        let rankedStatus = false;
                        if (map.ranked === 1) rankedStatus = true;
                        let object = {
                            hash: map.id,
                            name: map.name,
                            songAuthor: map.songAuthorName,
                            mapper: map.levelAuthorName,
                            bpm: map.bpm,
                            diff: map.diff,
                            stars: map.stars,
                            isRanked: rankedStatus
                        };
                        db.collection("scoresaberRankedMaps").insertOne(object, function (err) {
                            if (err) throw err;
                            //await db.collection("discordRankBotScores").updateMany({ hash: object.hash }, { $set: { ranked: true } }); // Untested

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

                            let mapData = await db.collection("beatSaverLocal").find({ hash: map[0].id }).toArray();
                            if (mapData.length === 0) mapData = await getBeatSaverMapData(map[0].id); //This does not currently work, fix

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
                                .setFooter("hahayes");

                            for (let l = 0; l < map.length; l++) {
                                const thisDiffData = difficultyData[convertDiffNameBeatSaver(map[l].diff)]
                                const NPS = Math.round(thisDiffData.notes / thisDiffData.length * 100) / 100
                                embed.addField(`${convertDiffNameVisual(map[l].diff)}`, `**${map[l].stars}** :star: | NJS: **${thisDiffData.njs}** | NPS: **${NPS}**`);
                            }
                            await message.channel.send(embed);
                        }
                    }
                }
            }
        };

        if (command === 'updateallcountry') {
            if (checkIfOwner(message)) {
                const dbres = await db.collection("discordRankBotUsers").find({}).toArray();
                for (let i = 0; i < dbres.length; i++) {
                    let user = await getUserFromScoreSaber(dbres[i].scId);
                    if (user) {
                        let myquery = { discId: dbres[i].discId };
                        let newvalue = { $set: { country: user.playerInfo.country } };

                        db.collection("discordRankBotUsers").updateOne(myquery, newvalue, function (err) {
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
        }

        if (command === 'emojiupload') {
            if (checkIfOwner(message)) {
                message.guild.emojis.create(`updooter2.png`, `small_green_triangle_up`).then(emoji => message.channel.send(`The following emoji was uploaded ${emoji}`));
            }
        }

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
                message.channel.send("Something went terribly wrong, either you fucked something up scoresaber or something else might be down...");
                console.log(err);
            }
        }

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
        }

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
        }

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
                            .addField("Ranks", `:globe_with_meridians: #${user.playerInfo.rank} \u200b \u200b \u200b :flag_${user.playerInfo.country.toLowerCase()}: #${user.playerInfo.countryRank}`)
                            .addField(`Stats`, `${user.playerInfo.pp}pp \u200b Acc: ${Math.round(user.scoreStats.averageRankedAccuracy * 100) / 100}%`)
                            .addFields(
                                { name: `Playcount`, value: `Total: ${user.scoreStats.totalPlayCount}`, inline: true },
                                //{ name: `\u200b`, value: `\u200b`, inline: true },
                                { name: `\u200b`, value: `Ranked: ${user.scoreStats.rankedPlayCount}`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter(`Remember to hydrate`);

                        message.channel.send(embed)
                    }
                    else message.channel.send(`Seems like we ran into an error, you should try again later`);
                }
            })
        }

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
        }

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
                                await message.author.send("You have successfully registered to the Finnish Beat Saber community discord. \nRemember to check the rules in the #info-etc channel and for further bot interaction go to #botstuff and enjoy your stay.")
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
        }

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
        }

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
                        message.channel.send("Something went terribly wrong, you can try again in a moment.")
                        console.log(`Tried to make an API call with id:${args[0]} but got the response ${user}`)
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
        }
    })
}
