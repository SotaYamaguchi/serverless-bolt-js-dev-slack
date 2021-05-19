const { App, ExpressReceiver } = require("@slack/bolt");
const serverlessExpress = require("@vendia/serverless-express");
const multiparty = require("multiparty");

const accessToken = process.env["SLACK_BOT_TOKEN"];

const expressReceiver = new ExpressReceiver({
  signingSecret: process.env["SLACK_SIGNING_SECRET"],
  processBeforeResponse: true,
});

const app = new App({
  token: accessToken,
  receiver: expressReceiver,
});

app.receiver.router.post("/slack/events/masseges", async (req, res) => {
  // req から fields を抽出する
  const data = await new Promise((resolve, reject) => {
    const form = new multiparty.Form();
    form.parse(req, (err, fields, files) => {
      resolve(fields);
    });
  });

  const massege = data.text.find((_, i) => i === 0);
  const userEmailList = data.email.find((_, i) => i === 0).split(",");

  let userIds = [];
  for (const email of userEmailList) {
    try {
      // DM チャンネル一覧を取得
      const user = await app.client.users.lookupByEmail({ token: accessToken, email: email });
      if (user) {
        userIds = [...userIds, user.user.id];
      }
    } catch (error) {
      console.log(error);
    }
  }

  // DMチャンネル一覧を取得
  const conversationsList = await app.client.conversations.list({
    token: accessToken,
    types: "im",
  });
  const channels = conversationsList.channels;

  if (!!userIds.length) {
    // メールアドレスから取得したユーザーの DM チャンネルのみにフィルター
    channels
      .filter((x) => {
        return userIds.some((y) => {
          return y === (x.user);
        });
      })
      .forEach((x) => {
        // メッセージ送信
        app.client.chat.postMessage({
          token: accessToken,
          channel: x.id,
          blocks: massege,
        });
      });
    }
  res.status(200).send('success!!');
});

// Handle the Lambda function event
module.exports.handler = serverlessExpress({
  app: expressReceiver.app,
});
