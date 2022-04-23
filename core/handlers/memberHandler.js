const Discord = require("discord.js");

class MemberHandler {
    constructor(client, db, config) {
        this.client = client;
        this.db = db;
        this.config = config;
    }

    init() {
        this.client.on("guildMemberAdd", async member => {
            if (member.guild.id === this.config.guildId) {
                const role = member.guild.roles.cache.find(role => role.name === "landed");
                member.roles.add(role);

                this.client.channels.cache.get(this.config.adminchannelID).send(`${member.user.username} joined the server.`);
                this.client.db.collection("landingMemberList").insertOne({ joinDate: Date.now(), toBeKickedDate: Date.now() + (1000 * 60 * 60 * 24), userId: member.user.id });

                setTimeout(this.newMemberTimerMessage, 1000 * 60 * 60 * 24, this.client, member.user.id);
            }
        });

        this.client.on("guildMemberRemove", async member => {
            await this.client.channels.cache.get(this.config.adminchannelID).send(`${member.user.username} left the server.`)
            let user = await this.client.db.collection("discordRankBotUsers").findOne({ discId: member.id });
            await this.client.db.collection("landingMemberList").deleteOne({ userId: member.id });

            if (!user) {
                console.log(`${member.user.username} left server but was not in db`);
            } else {
                this.client.db.collection("discordRankBotUsers").deleteOne({ discId: member.id }, function (err) {
                    if (err) throw err;
                    else console.log(`${member.user.username} left server so deleted from the database`);
                })
            }
        })
    };

    async newMemberTimerMessage(botClient, memberId) {
        const guild = await botClient.guilds.fetch(botClient.config.guildId);
        let member;
        try { member = await guild.members.fetch({ user: memberId, force: true }); }
        catch (err) {
            console.log("Couldnt find member", err);
            return;
        }
        if (member.roles.cache.find(role => role.name === "landed")) {
            let botmsg = await botClient.channels.cache.get(botClient.config.adminchannelID).send(`${member} joined 24h ago and has landed role still and should be kicked.\nKick?`);
            await botmsg.react(`✅`);
            await botmsg.react(`❌`);

            await botClient.db.collection("landingMemberList").deleteOne({ userId: member.user.id });

            //2 days time
            const filter = reaction => ['✅', '❌'].includes(reaction.emoji.name);
            const collector = botmsg.createReactionCollector(filter, { time: 1000 * 60 * 60 * 24 * 2 });
            collector.on('collect', async ({ emoji }) => {
                const mapArray = Array.from(emoji.reaction.users.cache);
                const reactedUser = `<@${mapArray[1][0]}>`
                if (emoji.name === '✅') {
                    try {
                        await member.send(`Hello you were kicked from the Finnish BS community Discord Tahti Sapeli for not registering in time, feel free to rejoin when you are ready to register. \nHei, sinut potkittiin pois suomi beat saber discordista koska et rekisteröitynyt ajoissa, voit liittyä takaisin kun olet valmis rekisteröitymään. \nhttps://discord.gg/qCtX7yBv7J`);
                    }
                    catch (err) {
                        console.log(`Could not send dm`, err)
                    }
                    await botmsg.reactions.removeAll();
                    await member.kick(`Did not register in time. Confirmed by: ${mapArray[1][1].username}`);
                    await botmsg.edit(`${reactedUser} confirmed kick of ${member}`);
                }
                else {
                    await botmsg.reactions.removeAll();
                    await botmsg.edit(`${reactedUser} denied kick of ${member}`);
                }
            });
        }
        else await botClient.db.collection("landingMemberList").deleteOne({ userId: member.user.id });
    }
}
module.exports = MemberHandler;