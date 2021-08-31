const Command = require("../core/command/command.js");
const Discord = require("discord.js");
const Bottleneck = require(`bottleneck`);

const limiter = new Bottleneck({
    maxConcurrent: 1
});

class Gains extends Command {
    async run(client, message, args) {
        const user = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });
        if (user !== null) {
            const scoresFromUser = await client.db.collection("discordRankBotScores").find({ player: user.scId, gained: true }).count();
            if (scoresFromUser > 0) {
                await client.scoresaber.getRecentScores(user.scId);
                const newScores = await client.db.collection("discordRankBotScores").find({ player: user.scId, gained: false }).toArray();

                let countOfBeatsavior = 0;
                let erroredMaps = 0;
                let totalLength = 0;
                let totalNotes = 0;
                let totalScore = 0;
                let totalMaxScore = 0;
                let totalLeftAcc = 0;
                let totalRightAcc = 0;
                let tdLeft = 0;
                let tdRight = 0;

                for (let i = 0; i < newScores.length; i++) {
                    let map;
                    let mapErrored = false;

                    try { map = await client.beatsaver.findMapByHash(newScores[i].hash); } catch (err) {
                        console.log("Map errored:\n" + err + "Hash: " + newScores[i].hash)
                        mapErrored = true;
                    };

                    if (map === undefined || map === null) {
                        mapErrored = true;
                        erroredMaps++;
                    }

                    if (!mapErrored) {
                        const versionIndex = map.versions.findIndex(versions => versions.hash === newScores[i].hash)
                        if (versionIndex == -1) {
                            erroredMaps++
                            continue;
                        }
                        const difficultyData = map.versions[versionIndex].diffs.find(e => e.characteristic === client.beatsaver.findPlayCategory(newScores[i].diff) && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(newScores[i].diff));

                        let mapTotalNotes = difficultyData.notes;

                        totalNotes = totalNotes + +mapTotalNotes;

                        if (newScores[i].maxscore === 0) {
                            let mapScores = await client.db.collection("beatSaverLocal").find({ leaderboardId: newScores[i].leaderboardId, maxscore: { $gt: 1 } }).toArray();

                            if (mapScores.length === 0) {
                                let mapTotalScore = client.scoresaber.calculateMaxScore(mapTotalNotes);
                                totalMaxScore = totalMaxScore + +mapTotalScore;
                                client.db.collection("discordRankBotScores").updateMany({ leaderboardId: newScores[i].leaderboardId }, { $set: { maxscore: totalScore } });
                            }
                            else {
                                totalMaxScore = totalMaxScore + +mapScores[0].maxscore
                            }
                        }
                        else totalMaxScore = totalMaxScore + +newScores[i].maxscore;

                        totalLength = totalLength + +map.metadata.duration;
                        totalScore = totalScore + +newScores[i].score;

                        if (newScores[i].beatsavior) {
                            countOfBeatsavior++;
                            const accTracker = newScores[i].beatsavior.trackers.accuracyTracker
                            isFinite(accTracker.accLeft) ? totalLeftAcc += accTracker.accLeft : totalLeftAcc += 115
                            isFinite(accTracker.accRight) ? totalRightAcc += accTracker.accRight : totalRightAcc += 115

                            isFinite(accTracker.leftTimeDependence) ? tdLeft += accTracker.leftTimeDependence : tdLeft += 0
                            isFinite(accTracker.rightTimeDependence) ? tdRight += accTracker.rightTimeDependence : tdRight += 0
                        }
                    }
                }

                const scProfile = await client.scoresaber.getUser(user.scId);

                await updateUserInfo(scProfile, message, client);

                const ppGained = Math.round((scProfile.playerInfo.pp - user.pp) * 100) / 100;
                const rankChange = user.rank - scProfile.playerInfo.rank;
                const countryRankChange = user.countryRank - scProfile.playerInfo.countryRank;

                const lengthString = new Date(totalLength * 1000).toISOString().substr(11, 8);
                const averageNPS = Math.round(totalNotes / totalLength * 100) / 100;
                const averageAccuracy = Math.round(totalScore / totalMaxScore * 10000) / 100 + "%";
                const averageAccuracyLeft = Math.round(totalLeftAcc / countOfBeatsavior * 100) / 100;
                const averageAccuracyRight = Math.round(totalRightAcc / countOfBeatsavior * 100) / 100;
                const averageTdLeft = Math.round(tdLeft * 100 / countOfBeatsavior * 100) / 100;
                const averageTdRight = Math.round(tdRight * 100 / countOfBeatsavior * 100) / 100;
                const fcAcc = Math.round(((averageAccuracyLeft + averageAccuracyRight) / 2) / 115 * 10000) / 100;

                const time = calculateTime(user.gainsDate);

                const embed = new Discord.MessageEmbed()
                    .setTitle(`Your gains`)
                    .setThumbnail(`${userAvatar(message.author.avatarURL())}`)
                    .addField(`Rank`, `${rankChange} ${Emote(user.rank, scProfile.playerInfo.rank, message)} ${scProfile.playerInfo.rank}`)
                    .addField(`PP`, `${ppGained} ${Emote(scProfile.playerInfo.pp, user.pp, message)} ${scProfile.playerInfo.pp}`)
                    .addField(`Country :flag_${scProfile.playerInfo.country.toLowerCase()}:`, `${countryRankChange} ${Emote(user.countryRank, scProfile.playerInfo.countryRank, message)} ${scProfile.playerInfo.countryRank}`)
                    .setFooter(`In the last ${time}.`)

                if (newScores.length > 0) {
                    embed.addField(`Playinfo`, `You played ${newScores.length} maps. \nDuration: ${lengthString}.`);
                    embed.addField(`Averages`, `NPS: ${averageNPS} | Acc: ${averageAccuracy}`);
                    if (averageAccuracyLeft > 0) {
                        embed.addField(`Beatsavior (${countOfBeatsavior})`, `TD: ${averageTdLeft} | ${averageTdRight}\nAcc: ${averageAccuracyLeft} | ${averageAccuracyRight}\nFC acc: ${fcAcc}%`)
                    }
                } else {
                    embed.addField(`Playinfo`, `No maps played.`)
                }
                if (erroredMaps > 0) {
                    embed.addField(`Could not find some maps`, `Unable to find ${erroredMaps} maps. Stats not counted.`)
                }
                try {
                    await message.channel.send(embed);
                    client.db.collection("discordRankBotScores").updateMany({ player: user.scId, gained: false }, { $set: { gained: true } })

                }
                catch (err) {
                    await message.channel.send("Could not send embed, try again")
                    console.log(err);
                }

            } else {
                let msg = "Setting up your gains for the first time, this will take a while depending on your playcount.\nYou will be pinged once done."
                if (limiter.jobs("EXECUTING").length > 0) msg += " You have been queued."
                message.channel.send(msg);

                limiter.schedule({ id: `Gains ${message.author.username}` }, async () => {
                    await client.scoresaber.getAllScores(user.scId);

                    const scProfile = await client.scoresaber.getUser(user.scId);

                    await updateUserInfo(scProfile, message, client);

                    message.channel.send(`${message.author} you are now setup to use gains command in the future.`);
                    client.db.collection("discordRankBotScores").updateMany({ player: user.scId, gained: false }, { $set: { gained: true } })
                })
            }


        }
        else message.channel.send(`You might not be registered, try doing ${client.config.prefix}addme command first.`);
    }
}
module.exports = Gains;

async function updateUserInfo(scProfile, message, client) {
    await client.db.collection("discordRankBotUsers").updateOne({ discId: message.author.id }, { $set: { discName: message.author.username, pp: scProfile.playerInfo.pp, gainsDate: Date.now(), rank: scProfile.playerInfo.rank, countryRank: scProfile.playerInfo.countryRank } });
}

function Emote(val1, val2, message) {
    if (val1 > val2) return message.guild.emojis.cache.find(emoji => emoji.name === "small_green_triangle_up");
    if (val1 === val2) return ":small_blue_diamond:";
    else return ":small_red_triangle_down:";
}

function userAvatar(avatarURL) {
    if (avatarURL) return avatarURL;
    else {
        const links = [
            "https://cdn.discordapp.com/attachments/840144337231806484/867097443744481280/angryghost.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097448707391528/baseghost.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097452338479134/make.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097456288989235/makeD.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097459925581824/makeEz.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097463433592842/makeHappy.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097467409661992/makeNose.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097471406833694/makeNotAmused.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097475738501147/makeSir.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097478793134100/makeSmallSmile.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097492512309268/makeSnowman.png",
            "https://cdn.discordapp.com/attachments/840144337231806484/867097498208305182/makeWater.png"
        ]
        let r = Math.floor(Math.random() * links.length);
        return links[r];
    }
}

function calculateTime(ms) {
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
    }
    return string;
}