class MemberHandler {
    constructor(client, db, config) {
        this.client = client;
        this.db = db;
        this.config = config;
    }

    init() {
        this.client.on("guildMemberAdd", member => {
            if (member.guild.id === this.config.guildId) {
                const role = member.guild.roles.cache.find(role => role.name === "landed");
                member.roles.add(role);

                this.client.channels.cache.get(this.config.adminchannelID).send(`${member.user.username} joined the server.`)

                setTimeout(newMemberTimerMessage, 1000 * 60 * 60 * 24, this.client, member, this.config.adminchannelID);
            }

        });

        this.client.on("guildMemberRemove", async member => {
            await this.client.channels.cache.get(this.config.adminchannelID).send(`${member.user.username} left the server.`)
            let user = await this.client.db.collection("discordRankBotUsers").findOne({ discId: member.id });

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
}

function newMemberTimerMessage(client, member, adminchannelID) {
    if (member.roles.cache.find(role => role.name === "landed")) {
        client.channels.cache.get(adminchannelID).send(`${member} joined 24h ago and has landed role still and should be kicked.`);
    }
}
module.exports = MemberHandler;