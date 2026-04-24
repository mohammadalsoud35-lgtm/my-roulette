const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const express = require('express');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gif-encoder-2');

const app = express();
app.get('/', (req, res) => res.send('Canvas Roulette is Online! 🎡'));
app.listen(3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

let gameActive = false;
let participants = [];
const MAIN_IMG = 'https://cdn.discordapp.com/attachments/1487339993130074115/1497027090179031240/356_20260210215455-1.png';

client.once('ready', () => console.log(`✅ ${client.user.tag} جاهز والتوكن آمن!`));

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.content !== '!روليت') return;
    if (gameActive) return message.reply('❌ فيه لعبة شغالة حالياً!');

    gameActive = true; 
    participants = [];
    let timer = 100;

    const startEmbed = new EmbedBuilder()
        .setTitle('🎡 روليت الفعاليات الملكي')
        .setDescription('**اضغط على الزر تحت عشان تشارك!**')
        .setColor('#2b2d31')
        .setImage(MAIN_IMG);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('join').setLabel('دخول').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('leave').setLabel('خروج').setStyle(ButtonStyle.Danger)
    );

    const msg = await message.channel.send({ 
        content: `🔔 @everyone\n⏳ الوقت المتبقي: **${timer}** ثانية\n👥 المشاركين: **(0/250)**`, 
        embeds: [startEmbed], 
        components: [row] 
    });

    const countdown = setInterval(async () => {
        timer -= 10;
        if (timer <= 0) {
            clearInterval(countdown);
            return startCanvasRound(message.channel);
        }
        await msg.edit({ content: `🔔 @everyone\n⏳ الوقت المتبقي: **${timer}** ثانية\n👥 المشاركين: **(${participants.length}/250)**` }).catch(() => {});
    }, 10000);
});

client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    if (i.customId === 'join') {
        if (!participants.includes(i.user.id)) { 
            participants.push(i.user.id); 
            return i.reply({ content: '✅ سجلت بنجاح!', ephemeral: true }); 
        }
        i.reply({ content: 'أنت مسجل فعلاً!', ephemeral: true });
    }
    if (i.customId === 'leave') { 
        participants = participants.filter(id => id !== i.user.id); 
        i.reply({ content: 'طلعت من اللعبة.', ephemeral: true }); 
    }
});

async function createSpinningWheel(playerNames) {
    const size = 500;
    const encoder = new GIFEncoder(size, size);
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(100);
    encoder.setQuality(10);
    
    const frames = 12;
    for (let f = 0; f < frames; f++) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size * 0.4;
        const num = playerNames.length;
        const rotation = (f / frames) * (Math.PI * 2) * 2;

        for (let i = 0; i < num; i++) {
            const startAngle = (i / num) * Math.PI * 2 + rotation;
            const endAngle = ((i + 1) / num) * Math.PI * 2 + rotation;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.fillStyle = (i % 2 === 0) ? '#e74c3c' : '#2b2d31';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + (Math.PI * 2 / num) / 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.fillText(playerNames[i].username.slice(0, 8), radius / 2, 5);
            ctx.restore();
        }
        encoder.addFrame(ctx);
    }
    encoder.finish();
    return encoder.out.getData();
}

async function startCanvasRound(channel) {
    if (participants.length < 2) { 
        gameActive = false; 
        return channel.send('❌ العدد غير كافي لبدء اللعبة.'); 
    }

    let playerNames = await Promise.all(participants.map(async (id) => {
        const member = await channel.guild.members.fetch(id).catch(() => null);
        return { id: id, username: member ? member.user.username : `لاعب` };
    }));

    const selectedPlayer = playerNames[Math.floor(Math.random() * playerNames.length)];

    if (participants.length === 2) {
        gameActive = false;
        return channel.send({ 
            content: `🏆 **الفائز النهائي هو: <@${selectedPlayer.id}> مبروك!**`, 
            embeds: [new EmbedBuilder().setImage(MAIN_IMG).setColor('Gold')] 
        });
    }

    const wheelBuffer = await createSpinningWheel(playerNames);
    const attachment = new AttachmentBuilder(wheelBuffer, { name: 'wheel.gif' });
    const wheelEmbed = new EmbedBuilder()
        .setTitle('🎡 العجلة تدور الآن...')
        .setImage('attachment://wheel.gif')
        .setColor('#f1c40f');

    let spinMsg = await channel.send({ embeds: [wheelEmbed], files: [attachment] });
    
    setTimeout(async () => {
        await spinMsg.delete().catch(() => {});
        renderEliminationButtons(channel, selectedPlayer.id, 0);
    }, 5000);
}

async function renderEliminationButtons(channel, selectedId, page) {
    const others = participants.filter(id => id !== selectedId);
    const start = page * 10;
    const currentBatch = others.slice(start, start + 10);

    const embed = new EmbedBuilder()
        .setTitle('🎯 الدور عندك يا بطل!')
        .setDescription(`<@${selectedId}>\n**اختار لاعب واحد عشان تطلعه من اللعبة! (عندك 15 ثانية)**`)
        .setImage(MAIN_IMG).setColor('#e74c3c');

    const rows = [];
    for (let i = 0; i < currentBatch.length; i += 2) {
        const row = new ActionRowBuilder();
        for (let j = i; j < i + 2 && j < currentBatch.length; j++) {
            const pId = currentBatch[j];
            const m = channel.guild.members.cache.get(pId);
            row.addComponents(new ButtonBuilder().setCustomId(`kick_${pId}`).setLabel(`${j + 1 + start} | ${m ? m.user.username : pId}`).setStyle(ButtonStyle.Secondary));
        }
        rows.push(row);
    }

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('random_kick').setLabel('🎲 عشوائي').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('next_page').setLabel('صفحة تالية').setStyle(ButtonStyle.Secondary).setDisabled(others.length <= start + 10)
    );
    rows.push(navRow);

    const msg = await channel.send({ content: `🔔 الدور عندك: <@${selectedId}>`, embeds: [embed], components: rows });
    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === selectedId, time: 15000, max: 1 });

    collector.on('collect', async i => {
        if (i.customId === 'next_page') { 
            await msg.delete(); 
            return renderEliminationButtons(channel, selectedId, page + 1); 
        }
        
        let victimId = i.customId === 'random_kick' ? others[Math.floor(Math.random() * others.length)] : i.customId.split('_')[1];
        participants = participants.filter(id => id !== victimId);
        
        await i.update({ content: `💥 تم إقصاء <@${victimId}> من الروليت!`, embeds: [], components: [] });
        setTimeout(() => startCanvasRound(channel), 2000);
    });

    collector.on('end', (c) => {
        if (c.size === 0) {
            participants = participants.filter(id => id !== selectedId);
            channel.send(`⏰ <@${selectedId}> تأخرت في الاختيار فتم إقصاؤك!`);
            setTimeout(() => startCanvasRound(channel), 2000);
        }
    });
}

client.login(process.env.TOKEN);
