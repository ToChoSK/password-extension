// Listener for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Password Manager Extension installed")
})

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getPasswordsForDomain") {
    const domain = message.domain
    getPasswordsForDomain(domain)
      .then((passwords) => {
        sendResponse({ success: true, passwords })
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
    return true // Indicates we will send a response asynchronously
  }

  if (message.action === "savePassword") {
    savePassword(message.data)
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }
})

// Upraviť funkciu getPasswordsForDomain() pre lepšiu podporu Facebook domén
async function getPasswordsForDomain(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get("passwords", (result) => {
      const allPasswords = result.passwords || []
      console.log("All passwords:", allPasswords.length)

      // Špeciálna logika pre Facebook domény
      const isFacebook = domain.includes("facebook.com") || domain.includes("fb.com")

      const matchingPasswords = allPasswords.filter((p) => {
        const passwordDomain = extractDomain(p.website)

        // Pre Facebook vrátime všetky Facebook heslá bez ohľadu na subdoménu
        if (isFacebook && (passwordDomain.includes("facebook.com") || passwordDomain.includes("fb.com"))) {
          return true
        }

        return passwordDomain === domain
      })

      console.log("Matching passwords for domain", domain, ":", matchingPasswords.length)
      resolve(matchingPasswords)
    })
  })
}

// Save a new password
async function savePassword(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("passwords", (result) => {
      const passwords = result.passwords || []

      // Generate a unique ID
      data.id = Date.now().toString()

      // Add the new password
      passwords.push(data)

      // Save back to storage
      chrome.storage.local.set({ passwords }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  })
}

// Upraviť funkciu extractDomain() pre lepšiu normalizáciu Facebook domén
function extractDomain(url) {
  let domain = url
  if (url.includes("://")) {
    domain = url.split("://")[1]
  }
  if (domain.includes("/")) {
    domain = domain.split("/")[0]
  }

  // Normalizácia Facebook domén
  if (domain.includes("facebook.com") || domain.includes("fb.com")) {
    // Normalizujeme všetky Facebook subdomény na facebook.com
    const parts = domain.split(".")
    const len = parts.length

    if (len >= 3 && parts[len - 2] === "facebook" && parts[len - 1] === "com") {
      return "facebook.com"
    }

    if (domain.includes("fb.com")) {
      return "facebook.com" // Normalizujeme fb.com na facebook.com
    }
  }

  return domain
}
