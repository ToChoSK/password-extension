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

// Get passwords for a specific domain
async function getPasswordsForDomain(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get("passwords", (result) => {
      const allPasswords = result.passwords || []
      const matchingPasswords = allPasswords.filter((p) => {
        const passwordDomain = extractDomain(p.website)
        return passwordDomain === domain
      })
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

// Helper function to extract domain from URL
function extractDomain(url) {
  let domain = url
  if (url.includes("://")) {
    domain = url.split("://")[1]
  }
  if (domain.includes("/")) {
    domain = domain.split("/")[0]
  }
  return domain
}
