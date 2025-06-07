const express = require("express")
const app = express()
const webPush = require("web-push")
const cors = require("cors")
require('dotenv').config()

const port = 3000;

//npx web-push generate-vapid-keys，產生公私鑰
const apiKeys = {
    publicKey: process.env.WEBPUSH_PUBLIC_KEY,
    privateKey: process.env.WEBPUSH_PRIVATE_KEY
}

webPush.setVapidDetails(
    'mailto:admin@github.com',
    apiKeys.publicKey,
    apiKeys.privateKey
)

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
    res.status(200).send("Hello world")
})

// 用記憶體模擬資料庫
const subDatabase = []

//儲存訂閱資訊(避免重複)
app.post("/save-subscription", (req, res) => {
    console.log("Received subscription: ", req.body)
    const newSub = req.body
    
    const exists = subDatabase.some(sub => sub.endpoint === newSub.endpoint)

    if(!exists){
        subDatabase.push(req.body)
        console.log("新訂閱儲存成功: ", newSub.endpoint)
    }else{
        console.log("訂閱已存在，略過儲存: ", newSub.endpoint)
    }

    res.status(200).json({ status: "success", message: "Subscription saved" })
})

//發送通知給所有訂閱(並列出成功/失敗)
app.get("/send-notification", async (req, res) => {
    const results = []

    //為什麼會有多個訂閱？因為沒處理舊的、重複按下訂閱、每個瀏覽器/分頁都可產生新訂閱。
    for(let i = 0; i < subDatabase.length; i++){
        const sub = subDatabase[i]
        try{
            await webPush.sendNotification(sub, "Hello world")
            results.push({index: i, endpoint: sub.endpoint,status: "Sent"})
        }catch(err){
            const statusCode = err.statusCode || 0
            results.push({index: i, endpoint: sub.endpoint,status: `Failed (${statusCode})`, error: err.message})

            //訂閱多久失效？沒有固定時間，但使用者取消授權、清除資料、service worker 被移除等情況會失效。
            //自動刪除 410 / 404 推播已失效的訂閱
            if(statusCode === 410 || statusCode === 404){
                subDatabase.splice(i, 1)
                console.log("已移除失效訂閱: ", sub.endpoint)
            }else{
                console.error("發送失敗: ", err.message)
            }
        }
    }
    
    res.status(200).json({
        status:"done",
        result: results
    })
})

app.listen(port, () => {
    console.log("Server running on port 3000!")
})
