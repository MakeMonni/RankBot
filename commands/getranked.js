const Command = require("../core/command/command.js");
const Discord = require('discord.js');

class GetRanked extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
            console.log(`Requesting ranked maps.`);
            const maps = await client.scoresaber.returnRankedMaps();

            if (!maps) {
                await message.channel.send("Sorry, no new maps & no changes to existing ones.")
                return;
            }

            //Use this to test embeds
            //const newMaps = await client.db.collection("scoresaberRankedMaps").find().toArray();
            const newMaps = maps.newMaps;
            const starChange = maps.starChange;

            let scoresToPpCheck = [];

            for (let i = 0; i < newMaps.length; i++) {
                const qualifiedPlays = await client.db.collection("discordRankBotScores").find({ hash: newMaps[i].hash, diff: newMaps[i].diff, pp: 0 }).toArray();

                for (let i = 0; i < qualifiedPlays.length; i++) {
                    let play = { playerId: qualifiedPlays[i].player, leaderboardId: qualifiedPlays[i].leaderboardId, playerName: "" }
                    scoresToPpCheck.push(play);
                }
            }

            await message.channel.send(`New maps: ${newMaps.length}.`)

            let addedHashes = [];
            let hashlist = [];
            let skipped = 0;
            if (args[0] === "nopost") return
            else {
                for (let i = 0; i < newMaps.length; i++) {
                    let map = []
                    if (!addedHashes.includes(newMaps[i].hash)) {
                        for (let j = 0; j < newMaps.length; j++) {
                            if (newMaps[i].hash === newMaps[j].hash) {
                                map.push(newMaps[j])
                                addedHashes.push(newMaps[i].hash);
                            }
                        }

                        map.sort(function (a, b) {
                            return b.stars - a.stars;
                        });

                        hashlist.push({
                            hash: map[0].hash,
                            difficulties: []
                        })

                        let mapData = await client.beatsaver.findMapByHash(map[0].hash);

                        const versionIndex = mapData.versions.findIndex(versions => versions.hash === map[0].hash)

                        const minutes = Math.floor(mapData.metadata.duration / 60);
                        const seconds = (mapData.metadata.duration - minutes * 60).toString().padStart(2, "0");

                        if (!map[0].mapper) map[0].mapper = "unknown mapper";

                        const embed = new Discord.MessageEmbed()
                            .setAuthor(`${map[0].name} ${map[0].subName} - ${map[0].songAuthor}`, `https://cdn.discordapp.com/attachments/840144337231806484/1081332431304540300/logo.png`, `https://scoresaber.com/leaderboard/${map[0].id}`)
                            .setThumbnail(`${mapData.versions[0].coverURL}`)
                            .addField(`Mapper`, `${map[0].mapper}`)
                            .addFields({ name: `BPM`, value: `${mapData.metadata.bpm}`, inline: true }, { name: `Length`, value: `${minutes}:${seconds}`, inline: true })
                            .setTimestamp()
                            .setFooter(`Remember to hydrate`);

                        for (let l = 0; l < map.length; l++) {
                            const thisDiffData = mapData.versions[versionIndex].diffs.find(e => e.characteristic === 'Standard' && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(map[l].diff));
                            hashlist[i - skipped].difficulties.push(
                                {
                                    characteristic: client.beatsaver.findPlayCategory("Standard"),
                                    name: client.beatsaver.convertDiffNameBeatSaver(map[l].diff)
                                }
                            )
                            const NPS = Math.round(thisDiffData.notes / thisDiffData.seconds * 100) / 100
                            embed.addField(`${client.beatsaver.convertDiffNameVisual(map[l].diff)}`, `**${map[l].stars}** :star: | NJS: **${thisDiffData.njs}** | NPS: **${NPS}**`);
                        }
                        const key = mapData.key;
                        embed.addField(`\u200b`, `[Download](${mapData.versions[0].downloadURL}) | [OneClick](http://api.monni.moe/oneclick?k=${key}) | [BeatSaver](https://beatsaver.com/maps/${key.toLowerCase()}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${key})`);
                        await message.channel.send(embed);
                    }
                    else skipped++
                }
                let changelog = "The following maps had their rating changed"
                let processedHashes = [];
                for (let i = 0; i < starChange.length; i++) {
                    let map = [];
                    if (!processedHashes.includes(starChange[i].hash)) {
                        for (let j = 0; j < starChange.length; j++) {
                            if (starChange[i].hash === starChange[j].hash) {
                                map.push(starChange[j])
                                processedHashes.push(starChange[i].hash);
                            }
                        }
                        map.sort(function (a, b) {
                            return b.stars - a.stars;
                        });

                        changelog += "\n\n-=-\n\n"
                        changelog += `${map[0].name} - ${map[0].songAuthor} by ${map[0].mapper}`;

                        for (let j = 0; j < map.length; j++) {
                            const diffName = client.beatsaver.convertDiffNameVisual(map[j].diff);
                            const oldStar = map[j].oldStar.toFixed(2).toString();
                            const newStar = map[j].stars.toFixed(2).toString();
                            changelog += `\n   ${diffName + ` `.repeat(10 - diffName.length)} ${oldStar + ` `.repeat(7 - oldStar.length)} > ${` `.repeat(7 - newStar.length) + newStar}`
                        }
                    }
                }

                if (newMaps.length > 0) {
                    const date = new Date()
                    const playlist = await client.misc.createPlaylist("NewestRanked", hashlist, "", null, `The freshest scoresaber ranked maps released on ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`);
                    await message.channel.send("The freshest ranked maps 🤌", playlist); //:pinched_fingers: emoji
                }

                if (starChange.length > 0) {
                    const attachment = await client.misc.txtAttachmentCreator(changelog, "reweightlog");
                    await message.channel.send(`Changelog of changed star values for ranked maps`, attachment);
                }
                else {
                    await message.channel.send("No star ratings reweighted")
                }

            }

            let uniquePlayer = []
            for (let i = 0; i < scoresToPpCheck.length; i++) {
                if (!(uniquePlayer.includes(scoresToPpCheck[i].playerId))) uniquePlayer.push(scoresToPpCheck[i].playerId)
            }
            for (let i = 0; i < uniquePlayer.length; i++) {
                const user = await client.scoresaber.getUser(uniquePlayer[i]);
                const scoresByUser = scoresToPpCheck.filter(e => e.playerId === uniquePlayer[i])
                for (let j = 0; j < scoresByUser.length; j++) {
                    await client.scoresaber.getUserScoreOnLeaderboard(scoresByUser[j].playerId, user.name, scoresByUser[j].leaderboardId)
                }
            }
        }
    }
}
module.exports = GetRanked;