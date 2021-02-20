const config = require('./config.json')

const Discord = require('discord.js');
const client = new Discord.Client();
const prefix = config.prefix
const fetch = require('node-fetch');

const Bottleneck = require(`bottleneck`);

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

const url = 'mongodb://localhost:27017';
const dbName = 'discordRankBot';

const limiter = new Bottleneck({
    reservoir: 70,
    reservoirRefreshAmount: 70,
    reservoirRefreshInterval: 60 * 1000,

    minTime: 860
});

MongoClient.connect(url, async (err, client) => {
    assert.strictEqual(null, err);
    console.log("Connected successfully to database");
    const db = client.db(dbName);

    await discordlogin();
    await discordClientReady();
    await memberLeft(db);

    await commandHandler(db);
});

async function memberLeft(db) {
    client.on('guildMemberRemove', (member) => {
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
        await console.log('Ready to rumble!');
        await statusOff();
    });
}

async function statusOff() {
    await client.user.setActivity("Updates OFF");
}

function checkIfOwner(message) {
    if (message.author.id === message.guild.ownerID) return true;
    else message.channel.send(`Sorry you lack the permissions for this command.`);
}

async function getUserFromScoreSaber(scoreSaberID) {
    try {
        let user = await limiter.schedule(async () => fetch(`https://new.scoresaber.com/api/player/${scoreSaberID}/full`)
            .then(res => res.json())
            .catch(err => { console.log(`Had an error: ${err} with scID:${scoreSaberID}`) }));

        if (!user.playerInfo) return null;
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

        await responses.push(user);
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

            const memberRoles = member.roles.cache.array().filter(role => !role.name.startsWith("Top"));

            if (responses[i].playerInfo.countryRank === 0) playerRank = -1;

            if (!responses[i].playerInfo.countryRank) {
                console.log(`There was an error with this user, most likely an API error, user: ${dbres[i].discName} sc:${dbres[i].scId}`)
                continue
            }

            let playerRank = responses[i].playerInfo.countryRank
            let addRole = null;

            if (playerRank === -1) {
                addRole = guild.roles.cache.filter(role => role.name === "Inactive").first();
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

            console.log(`Adding role ${addRole.name} to user ${dbres[i].discName}...`);
            memberRoles.push(addRole);
            member.roles.set(memberRoles);
            console.log(`...Success`);
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
        await console.log(`Updating rank roles.`);
        await UpdateAllRoles(db);
        await message.channel.send("Finished.");
        await console.log(`Completed role updates.`);

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
            message.channel.send("Haha yes good job testing :)");
        }

        /*
        if (command === 'getranked') {

            let maps = await fetch(`https://scoresaber.com/api.php?function=get-leaderboards&page=1&limit=${args[0]}&ranked={ranked_only}`)
                .then(res => res.json())
                .catch(err => { console.log(`${err}`) })

            console.log(`Found: ${maps.songs.length}`);

            let insertedMaps = 0;

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

                        insertedMaps++;
                        console.log(`Inserted map: ${map.name} with hash: ${map.id}`)
                    })
                }
                else {
                    console.log(`Map already existed in the db ${map.name}.`)
                }
            }
        };
        */

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

                    if (usersFlipped) users = await users.reverse();

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
                await console.log(`Starting updates`);
                await message.channel.send(`Updating all registered user roles.`);
                try {
                    await UpdateAllRoles(db);
                    await console.log(`Completed role updates.`);
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
                        message.channel.send(`${user.playerInfo.playerName} is rank ${user.playerInfo.countryRank} in ${user.playerInfo.country} with ${user.playerInfo.pp}pp`);
                    }
                    else message.channel.send(`Seems like we ran into an error, you should try again later`)
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
                let user = await getUserFromScoreSaber(args[0]);

                if (!user) {
                    message.channel.send("Something went terribly wrong, check your scoresaber id and try again.")
                    return
                }

                let myobj = { discId: message.author.id, scId: args[0], discName: message.author.username, country: user.playerInfo.country };
                let query = { discId: message.author.id };

                db.collection("discordRankBotUsers").find(query).toArray(function (err, dbres) {
                    if (err) throw err;
                    if (dbres?.length < 1) {
                        db.collection("discordRankBotUsers").insertOne(myobj, function (err) {
                            if (err) throw err;
                            console.log(`inserted ${message.author.username} with sc ${user.playerInfo.playerName}`);

                            function DMuser() {
                                message.author.send("You have successfully registered to the Finnish Beat Saber community discord. \nRemember to check the rules in the #info-etc channel and for further bot interaction go to #botstuff and enjoy your stay.")
                            }

                            if (user.playerInfo.country === config.country) {
                                if (message.member.roles.cache.some(role => role.name === 'landed')) {
                                    let addRole = message.guild.roles.cache.find(role => role.name === "Verified");
                                    message.member.roles.set([addRole])
                                        .then(DMuser())
                                        .catch(console.log);
                                }
                                else message.channel.send(`You have been added and your role will be set with the next update, or if you are impatient you can run ${prefix}roleme.`);
                            }
                            else {
                                if (message.member.roles.cache.some(role => role.name === 'landed')) {
                                    let addRole = message.guild.roles.cache.find(role => role.name === "Guest");
                                    message.member.roles.set([addRole])
                                        .then(DMuser())
                                        .catch(console.log);
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
