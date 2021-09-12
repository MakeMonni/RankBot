const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Leaderboard extends Command {
    async run(client, message, args) {

        if (args[0] !== "old") {
            if (!args[0]) {
                await message.channel.send(`No key provided. Try \`${client.config.prefix}leaderboard 25f expert+\``);
                return;
            }
            else if (client.beatsaver.isKey(args[0])) {
                const map = await client.beatsaver.findMapByKey(args[0]);
                if (!map) {
                    await message.channel.send("Failed to find map, make sure it is not deleted from beatsaver...");
                    return;
                }
                else if (!args[1]) {
                    let diffs = "";
                    for (let i = 0; i < map.versions[0].diffs.length; i++) {
                        diffs += `\n${map.versions[0].diffs[i].difficulty}`
                    }
                    await message.channel.send("The map has the following difficulties, please pick one: " + diffs);
                    return;
                }
                else {
                    const mapHash = map.versions[0].hash
                    const mapDiff = client.beatsaver.convertDiffNameScoreSaber(args[1]);

                    const scores = await client.db.collection("discordRankBotScores").find({ hash: mapHash, diff: mapDiff }).toArray();

                    if (scores.length === 0) {
                        message.channel.send("No scores found on that leaderboard.");
                        return;
                    }

                    const versionIndex = map.versions.findIndex(versions => versions.hash === scores[0].hash)

                    scores.sort(function (a, b) {
                        return b.score - a.score || a.date - b.date;
                    });

                    const embed = new Discord.MessageEmbed()
                        .setAuthor(`${map.metadata.songName} ${map.metadata.songSubName} - ${map.metadata.songAuthorName}`, `https://new.scoresaber.com/apple-touch-icon.46c6173b.png`, `https://scoresaber.com/leaderboard/${scores[0].leaderboardId}`)
                        .setThumbnail(`${map.versions[versionIndex].coverURL}`)
                        .addField(`Mapper`, `${map.metadata.levelAuthorName}`, true)
                        .addField(`Difficulty`, `${client.beatsaver.convertDiffNameVisual(scores[0].diff)}`, true)
                        .setTimestamp()
                        .setFooter(`Remember to hydrate`);

                    for (let i = 0; i < scores.length; i++) {
                        if (i >= 10) {
                            embed.addField(`\u200b`, `And ${scores.length - 10} others...`)
                            break;
                        }
                        else {
                            let playerName;
                            let player = await client.db.collection("discordRankBotUsers").find({ scId: scores[i].player }).toArray();
                            if (player.length === 0) {
                                player = await client.scoresaber.getUser(scores[i].player);
                                playerName = player.playerInfo.playerName;
                            }
                            else {
                                playerName = player[0].discName;
                            }

                            if (scores[i].maxscore === 0) {
                                const difficultyData = map.versions[versionIndex].diffs.find(e => e.characteristic === client.beatsaver.findPlayCategory(scores[0].diff) && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(scores[0].diff));

                                scores[i].maxscore = client.scoresaber.calculateMaxScore(difficultyData.notes)
                            }
                            let date = new Date(scores[i].date);
                            embed.addField(`${i + 1}. ${playerName}`, ` ${new Intl.NumberFormat('fi-FI').format(scores[i].score)} - ${Math.round((scores[i].score / scores[i].maxscore) * 10000) / 100}% - ${date.getDate()}.${(date.getMonth()) + 1}.${date.getFullYear()}`);
                        }
                    }

                    const key = map.key;
                    embed.addField(`\u200b`, `[Download](https://beatsaver.com${map.downloadURL}) | [BeatSaver](https://beatsaver.com/beatmap/${key}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${key})`);

                    message.channel.send(embed);
                }
            }
        }
        else if (args[0] === "old") {
            if (isFinite(args[1])) {
                const scores = await client.db.collection("discordRankBotScores").find({ leaderboardId: parseInt(args[1], 10) }).toArray();
                if (scores.length === 0) {
                    message.channel.send("No scores found on that leaderboard.");
                    return;
                } else {
                    const map = await client.beatsaver.findMapByHash(scores[0].hash);

                    if (map === undefined) {
                        message.channel.send("Failed to find map, make sure it is not deleted from beatsaver...")
                        return;
                    }

                    const versionIndex = map.versions.findIndex(versions => versions.hash === scores[0].hash)

                    scores.sort(function (a, b) {
                        return b.score - a.score || a.date - b.date;
                    });

                    const embed = new Discord.MessageEmbed()
                        .setAuthor(`${map.metadata.songName} ${map.metadata.songSubName} - ${map.metadata.songAuthorName}`, `https://new.scoresaber.com/apple-touch-icon.46c6173b.png`, `https://scoresaber.com/leaderboard/${args[1]}`)
                        .setThumbnail(`${map.versions[versionIndex].coverURL}`)
                        .addField(`Mapper`, `${map.metadata.levelAuthorName}`, true)
                        .addField(`Difficulty`, `${client.beatsaver.convertDiffNameVisual(scores[0].diff)}`, true)
                        .setTimestamp()
                        .setFooter(`Remember to hydrate`);

                    for (let i = 0; i < scores.length; i++) {
                        if (i >= 10) {
                            embed.addField(`\u200b`, `And ${scores.length - 10} others...`)
                            break;
                        }
                        else {
                            let playerName;
                            let player = await client.db.collection("discordRankBotUsers").find({ scId: scores[i].player }).toArray();
                            if (player.length === 0) {
                                player = await client.scoresaber.getUser(scores[i].player);
                                playerName = player.playerInfo.playerName;
                            }
                            else {
                                playerName = player[0].discName;
                            }

                            if (scores[i].maxscore === 0) {
                                const difficultyData = map.versions[versionIndex].diffs.find(e => e.characteristic === client.beatsaver.findPlayCategory(scores[0].diff) && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(scores[0].diff));

                                scores[i].maxscore = client.scoresaber.calculateMaxScore(difficultyData.notes)
                            }
                            let date = new Date(scores[i].date);
                            embed.addField(`${i + 1}. ${playerName}`, ` ${new Intl.NumberFormat('fi-FI').format(scores[i].score)} - ${Math.round((scores[i].score / scores[i].maxscore) * 10000) / 100}% - ${date.getDate()}.${(date.getMonth()) + 1}.${date.getFullYear()}`);
                        }
                    }

                    const key = map.key;
                    embed.addField(`\u200b`, `[Download](https://beatsaver.com${map.downloadURL}) | [BeatSaver](https://beatsaver.com/beatmap/${key}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${key})`);

                    message.channel.send(embed);
                }
            } else message.channel.send("That was not a number >:(");

        }
        else {
            await message.channel.send(`Try running the command like this \`${client.config.prefix}leaderboard 25f expert+\``)
        }
    }
}

module.exports = Leaderboard;