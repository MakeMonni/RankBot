const Command = require("../core/command/command.js");
const Discord = require("discord.js")

class Me extends Command {
    async run(client, message, args) {
        const dbuser = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });
        if (!dbuser) {
            message.channel.send(`I'm sorry I could not find you in the database.\nTry using ${client.config.prefix}addme <scoresaberid> to get added into this awesome system.`);
        } else {
            let user = await client.scoresaber.getUser(dbuser.scId);
            if (user) {
                const embed = new Discord.MessageEmbed()
                    .setColor('#513dff')
                    .setThumbnail(user.profilePicture)
                    .addField('Profile', `[__${user.name}__](https://scoresaber.com/u/${dbuser.scId})`)
                    .addField("Ranks", `:globe_with_meridians: #${user.rank} \u200b \u200b \u200b :flag_${(user.country).toLowerCase()}: #${user.countryRank}`)
                    .addField(`Stats`, `${new Intl.NumberFormat('fi-FI').format(user.pp)}pp \u200b Acc: ${Math.round(user.scoreStats.averageRankedAccuracy * 100) / 100}%`)
                    .addFields({ name: `Playcount`, value: `Total: ${user.scoreStats.totalPlayCount}`, inline: true }, { name: `\u200b`, value: `Ranked: ${user.scoreStats.rankedPlayCount}`, inline: true })
                    .setTimestamp()
                    .setFooter(`Remember to hydrate`);

                if (await client.db.collection("discordRankBotScores").find({ player: user.id }).count() > 0) {
                    const result = await client.db.collection("discordRankBotScores").aggregate([
                        { $match: { ranked: true, country: user.country } },
                        { $sort: { score: -1, date: 1 } },
                        {
                            $group: {
                                _id: { leaderboardId: "$leaderboardId" },
                                scores: { $push: { score: "$score", player: "$player" } }
                            }
                        },
                    ]).toArray()

                    let number1 = [];
                    let pos = [];
                    for (let i = 0; i < result.length; i++) {
                        const index = result[i].scores.findIndex(e => e.player === user.id)
                        if (index !== -1) {
                            pos.push(index + 1);
                            if (index === 0) {
                                number1.push(result[i]._id.leaderboardId)
                            }
                        }
                    }

                    console.log("Rank1s", number1);

                    const count = (arr, val) => arr.reduce((a, v) => (v === val ? a + 1 : a), 0);

                    const avgRank = Math.round(pos.reduce((p, c) => p + c, 0) / pos.length * 100) / 100;

                    const minRank = Math.min.apply(Math, pos.map(function (e) { return e }))
                    const minCount = count(pos, minRank);

                    const secondMin = Math.min.apply(null, pos.filter(n => n != minRank));
                    const secondMinCount = count(pos, secondMin);

                    const thirdMin = Math.min.apply(null, pos.filter(n => n != minRank && n != secondMin));
                    const thirdMinCount = count(pos, thirdMin);

                    embed.addField("Country ranks", `Average: **${avgRank}**\nBest: **#${minRank}** (${minCount}) | **#${secondMin}** (${secondMinCount}) | **#${thirdMin}** (${thirdMinCount})`)
                }

                await message.channel.send(embed)
            } else message.channel.send(`Seems like we ran into an error, you should try again later`);
        }
    }
}
module.exports = Me;