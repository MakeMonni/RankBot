const Command = require("../core/command/command.js");
const Discord = require("discord.js") 

class Me extends Command {
    async run(client, message, args) {
        const query = { discId: message.author.id };
        client.db.collection("discordRankBotUsers").find(query).toArray(async function (err, dbres) {
            if (err) throw err;
            if (!dbres[0]?.scId) {
                message.channel.send(`I'm sorry I could not find you in the database.\nTry using ${client.config.prefix}addme <scoresaberid> to get added into this awesome system.`);
            } else {
                let user = await client.scoresaber.getUser(dbres[0].scId);
                if (user) {
                    const embed = new Discord.MessageEmbed()
                        .setColor('#513dff')
                        .setThumbnail(user.profilePicture)
                        .addField('Profile', `[__${user.name}__](https://scoresaber.com/u/${dbres[0].scId})`)
                        .addField("Ranks", `:globe_with_meridians: #${user.rank} \u200b \u200b \u200b :flag_${(user.country).toLowerCase()}: #${user.countryRank}`)
                        .addField(`Stats`, `${new Intl.NumberFormat('fi-FI').format(user.pp)}pp \u200b Acc: ${Math.round(user.scoreStats.averageRankedAccuracy * 100) / 100}%`)
                        .addFields({ name: `Playcount`, value: `Total: ${user.scoreStats.totalPlayCount}`, inline: true }, { name: `\u200b`, value: `Ranked: ${user.scoreStats.rankedPlayCount}`, inline: true })
                        .setTimestamp()
                        .setFooter(`Remember to hydrate`);

                    message.channel.send(embed)
                } else message.channel.send(`Seems like we ran into an error, you should try again later`);
            }
        })
    }
}
module.exports = Me;