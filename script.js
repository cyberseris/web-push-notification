//用來將 VAPID 公鑰（base64 格式） 轉成 Uint8Array（位元組陣列），成推播 API 可用的格式，以便傳入 pushManager.subscribe()。
const urlBase64ToUnit8Array = base64String => {
    //Base64 要求長度是 4 的倍數。若不是，要加上 = 補齊。
    const padding = '='.repeat(( 4 - (base64String.length % 4)) % 4)

    /* Web Push 的 VAPID 公鑰是 "URL-safe Base64" 版本，它把：
    [+ 換成 -]、[/ 換成 _]，這裡是轉回原始 Base64 形式，才能用  atob() 解碼。*/
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    //解碼成原始二進位資料
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    //把解碼後的每個字元轉成對應的 ASCII 值
    // base64: "SGVsbG8h" => "Hello!"(atob) => Uint8Array(6) [72, 101, 108, 108, 111, 33], 例如 H 的 ASCII 值 72
    for(let i = 0; i < rawData.length; ++i){
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

const checkPermission = () => {
    //navigator.serviceWorker：註冊與管理 service worker 的入口
    //檢查是否支援 service worker
    if(!('serviceWorker' in navigator)){
        throw new Error("No support for service worker!")
    }

    //檢查是否支援「通知」 API
    if(!('Notification' in window)){
        throw new Error("No support for notification API")
    }

    //檢查是否支援「推播」API
    if(!('PushManager' in window)){
        throw new Error("No support for Push API")
    }
}

//註冊完 Service Worker 後，它就會開始處於監聽狀態，可以處理各種事件（如 push, fetch, sync 等）
const registerSW = async () => {
    const registration = await navigator.serviceWorker.register('sw.js')
    return registration
}

const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission()

    if(permission !== 'granted'){
        throw new Error("Notification permission not granted")
    }
}

//接收一個訂閱物件，向伺服器註冊訂閱
const saveSubscription = async (subscription) => {
    const response = await fetch('http://localhost:3000/save-subscription', {
        method: 'post',
        headers: { 'Content-type': "application/json" },
        body: JSON.stringify(subscription)
    })

    if(!response.ok){
        throw new Error(`Server error: ${response.status}`)
    }

    const result = await response.json()
    console.log("Server acknowledged subscription:", result.message)

    return result.message
}


//前端取消舊訂閱，但伺服器上記憶體裡的舊訂閱資料沒有刪掉，後端需另外處理，測試用，強制取消訂閱
/* const unregisterOldSubscription = async (registration) => {
    const subscription = await registration.pushManager.getSubscription()
    
    if(subscription){
        console.log("Found existing subscription, unsubscribing...")
        await subscription.unsubscribe()
        console.log("Old subscription removed.")
    }else{
        console.log("No existing subscription")
    }
} */


const main = async () => {
    //檢查權限
    checkPermission()
    //要求開啟通知權限
    await requestNotificationPermission()
    //註冊完 Service Worker 後，它就會開始處於監聽狀態，可以處理各種事件（如 push, fetch, sync 等）
    const registration = await registerSW()

    // 移除舊的訂閱（如果有），測試用，強制取消訂閱
    /* await unregisterOldSubscription(registration) */
    const subscription = await registration.pushManager.getSubscription()

    //判斷現狀是否有訂閱
    if(subscription){
        console.log("已有訂閱，直接使用")
        await saveSubscription(subscription)
    }else{
        // 使用公鑰，建立新訂閱
        const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUnit8Array("BDgiCyiO9piCbZWk_2OFlqy-3zdPmtsCNNADUk1W1za5Z8qx76E9u1j9zkuBJb5QociIoOr4xgLbQTpIoovpN7I")
        })

        await saveSubscription(newSubscription)
    }
}
