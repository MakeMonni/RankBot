const Command = require("../core/command/command.js");
const Discord = require("discord.js");

class Compare extends Command {
    async run(client, message, args) {
        await message.channel.send("It borked, waiting to be fixed.")
        return;
        try {
            let usersToCheck = [];
            let users = [];
            if (!args[0]) {
                await message.channel.send(`No user provided to compare to. Example: \`\`\`${client.config.prefix}compare @user/scoresaberid\`\`\``);
                return;
            }

            const dbres = await client.db.collection("discordRankBotUsers").findOne({ discId: message.author.id });

            if (dbres) {
                usersToCheck.push(dbres.scId);
                let user = await client.misc.getUserFromMention(args[0]);

                console.log(user);

                let usersFlipped = false;
                let foundComparableUser = false;

                if (user && args[0]) {
                    const mentioneddbres = await client.db.collection("discordRankBotUsers").find({ discId: user.id }).toArray();

                    if (mentioneddbres.length !== 0) {
                        usersToCheck.push(mentioneddbres[0].scId);
                        foundComparableUser = true;
                    }
                }
                else if (!user) {
                    let scuser = await client.scoresaber.getUser(args[0]);

                    if (scuser.playerInfo) {
                        users.push(scuser);
                        foundComparableUser = true;
                    }

                    usersFlipped = true;
                }

                for (let i = 0; i < usersToCheck.length; i++) {
                    let scuser = await client.scoresaber.getUser(usersToCheck[i]);
                    users.push(scuser);
                }

                if (usersFlipped) users = users.reverse();

                if (!foundComparableUser) {
                    message.channel.send("The pinged user does not seem to be registered.")
                }
                else if (users[0] && users[1] && users[0].id === users[1].id) {
                    message.channel.send("Stop trying to compare yourself to yourself...");
                }
                else if (users[0] && users[1] && users[0].id !== users[1].id) {
                    console.log(`Comparing users: ${users[0].name} and ${users[1].name}.`)

                    let ppDifference = ((users[0].pp) - (users[1].pp)).toFixed(2);
                    let ppBiggerOrSmaller = BiggerOrSmaller(users[0].pp, users[1].pp);

                    let accDifference = ((users[0].scoreStats.averageRankedAccuracy) - (users[1].scoreStats.averageRankedAccuracy)).toFixed(2);
                    let accBiggerOrSmaller = BiggerOrSmaller(users[0].scoreStats.averageRankedAccuracy, users[1].scoreStats.averageRankedAccuracy);

                    let rankDifference = ((users[0].rank) - (users[1].rank));
                    let rankBiggerOrSmaller = BiggerOrSmaller(users[0].rank, users[1].rank);

                    const embed = new Discord.MessageEmbed()
                        .setAuthor(`Comparing`, users[0].profilePicture, ``)
                        .setThumbnail(users[1].profilePicture)
                        .setColor('#513dff')
                        .addField(`Users`, `[${users[0].name}](https://new.scoresaber.com/u/${usersToCheck[0]} 'Scoresaber - ${users[0].name}') - [${users[1].name}](https://new.scoresaber.com/u/${users[1].id} 'Scoresaber - ${users[1].name}')`)
                        .addFields({
                            name: `PP`,
                            value: `${Math.round((users[0].pp) * 100) / 100} ${ppBiggerOrSmaller} ${Math.round((users[1].pp) * 100) / 100} \n${Emote(users[0].pp, users[1].pp, message)}  **${Math.round((ppDifference) * 100) / 100}pp**`
                        }, {
                            name: `Acc`,
                            value: `${Math.round((users[0].scoreStats.averageRankedAccuracy) * 100) / 100}% ${accBiggerOrSmaller} ${Math.round((users[1].scoreStats.averageRankedAccuracy) * 100) / 100}% \n${Emote(users[0].scoreStats.averageRankedAccuracy, users[1].scoreStats.averageRankedAccuracy, message)}  **${Math.round((accDifference) * 100) / 100}%**`
                        }, {
                            name: `Rank`,
                            value: `${users[0].rank} ${rankBiggerOrSmaller} ${users[1].rank} \n${Emote(users[1].rank, users[0].rank, message)} **${rankDifference * -1}**`
                        })
                        .setTimestamp()
                        .setFooter(`Remember to hydrate`);

                    message.channel.send(embed);
                }
            }
            else {
                message.channel.send("You are propably not registered...")
            }
        } catch (err) {
            message.channel.send("Something went terribly wrong, either you fucked something up or scoresaber or something else might be down...");
            console.log(err);
        }
    }
}
module.exports = Compare;

function BiggerOrSmaller(val1, val2) {
    if (val1 > val2) return `>`;
    else return `<`;
}

function Emote(val1, val2, message) {
    if (val1 > val2) return message.guild.emojis.cache.find(emoji => emoji.name === "small_green_triangle_up");
    else return ":small_red_triangle_down:";
}