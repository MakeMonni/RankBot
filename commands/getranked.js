const Command = require("../core/command/command.js");
const Discord = require('discord.js');
const fetch = require('node-fetch');

class GetRanked extends Command {
    async run(client, message, args) {
        if (client.checkIfOwner(message)) {
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
                const dbres = await client.db.collection("scoresaberRankedMaps").find(query).toArray();

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
                    client.db.collection("scoresaberRankedMaps").insertOne(object, async function (err) {
                        if (err) throw err;

                        if (args[1] !== "nopost") {
                            const qualifiedPlays = await client.db.collection("discordRankBotScores").find({ hash: object.hash, diff: map.diff, pp: 0 }).toArray();

                            for (let i = 0; i < qualifiedPlays.length; i++) {
                                let play = { player: qualifiedPlays[i].player, leaderboardId: qualifiedPlays[i].leaderboardId }
                                scoresToPpCheck.push(play);
                            }
                        }

                        await client.db.collection("discordRankBotScores").updateMany({ hash: object.hash }, { $set: { ranked: true } });

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


                        let mapData = await client.beatsaver.findMapByHash(map[0].id);

                        const versionIndex = mapData.versions.findIndex(versions => versions.hash === map[0].id)

                        const minutes = Math.floor(mapData.metadata.duration / 60);
                        const seconds = (mapData.metadata.duration - minutes * 60).toString().padStart(2, "0");

                        const embed = new Discord.MessageEmbed()
                            .setAuthor(`${map[0].name} ${map[0].songSubName} - ${map[0].songAuthorName}`, `https://new.scoresaber.com/apple-touch-icon.46c6173b.png`, `https://scoresaber.com/leaderboard/${map[0].uid}`)
                            .setThumbnail(`https://scoresaber.com${map[0].image}`)
                            .addField(`Mapper`, `${map[0].levelAuthorName}`)
                            .addFields({ name: `BPM`, value: `${map[0].bpm}`, inline: true }, { name: `Length`, value: `${minutes}:${seconds}`, inline: true })
                            .setTimestamp()
                            .setFooter(`Remember to hydrate`);

                        for (let l = 0; l < map.length; l++) {
                            const thisDiffData = mapData.versions[versionIndex].diffs.find(e => e.characteristic === 'Standard' && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(map[l].diff));
                            const NPS = Math.round(thisDiffData.notes / thisDiffData.length * 100) / 100
                            console.log(client.beatsaver.convertDiffNameVisual(map[l].diff) + "  " + map[l].diff)
                            embed.addField(`${client.beatsaver.convertDiffNameVisual(map[l].diff)}`, `**${map[l].stars}** :star: | NJS: **${thisDiffData.njs}** | NPS: **${NPS}**`);
                        }
                        const key = mapData.key;
                        embed.addField(`\u200b`, `[Download](https://beatsaver.com${mapData.downloadURL}) | [BeatSaver](https://beatsaver.com/beatmap/${key}) | [Preview](https://skystudioapps.com/bs-viewer/?id=${key})`);
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

            let scoresToPpCheckWithIndex = [];

            // #2. Get recent from players with scores
            for (let i = 0; i < uniquePlayer.length; i++) {
                let thisPlayerScores = [];

                for (let j = 0; j < scoresToPpCheck.length; j++) {
                    if (uniquePlayer[i] === scoresToPpCheck[j].player) thisPlayerScores.push(scoresToPpCheck[j])
                }

                await client.scoresaber.getRecentScores(uniquePlayer[i]);
                let scores = await client.db.collection("discordRankBotScores").find({ player: uniquePlayer[i] }).sort({ date: -1 }).toArray();

                // #3. Find player plays and go trough to find index
                for (let j = 0; j < thisPlayerScores.length; j++) {
                    thisPlayerScores[j].index = scores.findIndex(map => map.leaderboardId === thisPlayerScores[j].leaderboardId);
                    scoresToPpCheckWithIndex.push(thisPlayerScores[j])
                }
            }

            for (let i = 0; i < scoresToPpCheck.length; i++) {
                scoresToPpCheck[i].page = Math.floor((scoresToPpCheck[i].index / 8) + 1)

                await client.scoresaber.getOnePageRecent(scoresToPpCheck[i].player, scoresToPpCheck[i].leaderboardId, scoresToPpCheck[i].page)
            }
        }
    }
}
module.exports = GetRanked;