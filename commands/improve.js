const Command = require("../core/command/command.js");

class Test extends Command {
    async run(client, message, args) {
        if (!args[0]) {
            await message.channel.send("No arguments provided");
            return;
        }

        const user = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });
        if (user !== null) {
            const botmsg = await message.channel.send("Gathering scores, one moment please :)")

            const scores = await client.db.collection("discordRankBotScores").find({ player: user.scId, ranked: true }).sort({ date: 1 }).toArray();
            if (scores.length === 0) {
                await message.channel.send(`Try using the \`${client.config.prefix}gains\` command first`);
                return;
            }
            let hashlist = [];
            if (args[0] === "unplayed") {
                //Do comparison with full ranked list here compared to all ranked plays by player -> then playlist from != found
            }
            else {
                if (args[0] === "over" || args[0] === "under") {
                    if (isFinite(args[1]) && args[1] >= 0 && args[1] <= 100) {
                        await client.scoresaber.getRecentScores(user.scId);
                        for (let i = 0; i < scores.length; i++) {
                            try {
                                if (scores[i].maxscore === 0) {
                                    let map;

                                    try { map = await client.beatsaver.findMapByHash(scores[i].hash); } catch (err) {
                                        console.log("Map errored:\n" + err + "Hash: " + scores[i].hash)
                                    };

                                    const versionIndex = map.versions.findIndex(versions => versions.hash === scores[i].hash);
                                    const difficultyData = map.versions[versionIndex].diffs.find(e => e.characteristic === client.beatsaver.findPlayCategory(scores[i].diff) && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(scores[i].diff));
                                    let mapTotalNotes = difficultyData.notes;

                                    // FIX 
                                    // Spaghetti here

                                    let mapScores = await client.db.collection("beatSaverLocal").find({ leaderboardId: scores[i].leaderboardId, maxscore: { $gt: 1 } }).toArray();

                                    if (mapScores.length === 0) {
                                        scores[i].maxscore = await client.scoresaber.calculateMaxScore(mapTotalNotes);
                                        await client.db.collection("discordRankBotScores").updateMany({ leaderboardId: scores[i].leaderboardId }, { $set: { maxscore: scores[i].maxscore } });
                                    }
                                    else if (mapScores[0].maxscore != 0) {
                                        scores[i].maxscore = mapScores[0].maxscore;
                                        await client.db.collection("discordRankBotScores").updateMany({ leaderboardId: scores[i].leaderboardId }, { $set: { maxscore: scores[i].maxscore } });
                                    }
                                    else {
                                        scores[i].maxscore = await client.scoresaber.calculateMaxScore(mapTotalNotes);
                                        await client.db.collection("discordRankBotScores").updateMany({ leaderboardId: scores[i].leaderboardId }, { $set: { maxscore: scores[i].maxscore } });
                                    }
                                }

                                if (Comparer(args[0], args[1] / 100, scores[i].score / scores[i].maxscore)) {
                                    const songHash = {
                                        hash: scores[i].hash,
                                        difficulties: [
                                            {
                                                characteristic: client.beatsaver.findPlayCategory(scores[i].diff),
                                                name: client.beatsaver.convertDiffNameBeatSaver(scores[i].diff)
                                            }
                                        ]
                                    }
                                    hashlist.push(songHash);
                                }
                            }
                            catch (err) {
                                console.log(err);
                                console.log(scores[i]);
                            }
                        }

                        if (hashlist.length === 0) {
                            await message.channel.send("No valid maps in that category.")
                            return;
                        }

                        botmsg.delete();
                        const playlistAttachment = await client.misc.createPlaylist(`Improve_${args[0]}_${args[1]}`, hashlist, "https://cdn.discordapp.com/attachments/840144337231806484/900475734462705694/stronk.png", null, `Playlist contains your scores under ${args[1] / 100}% acc.`);
                        await message.channel.send(`${message.author}, here is your playlist. Time to improve\nIt has ${hashlist.length} maps.`, playlistAttachment);
                    }
                    else {
                        await message.channel.send("Not a valid amount to improve on. \nMin: **0** \nMax: **100**")
                    }
                }

                else {
                    await message.channel.send("Invalid operator chosen, use \`over\` or \`under\`");
                    return;
                }
            }

        }
        else message.channel.send(`You might not be registered, try doing ${client.config.prefix}addme command first.`);
    }
}
module.exports = Test;

function Comparer(operator, target, current) {
    if (current === 100) {
        return false;
    }
    else if (operator === "over") {
        if (target < current) return true;
        else return false
    }
    else if (operator === "under")
        if (target > current) return true;
        else return false
}