document.addEventListener("DOMContentLoaded", () => {
  // Navigation
  const browseBtn = document.getElementById("browse-btn")
  const favoritesBtn = document.getElementById("favorites-btn")
  const settingsBtn = document.getElementById("settings-btn")
  const mainContent = document.getElementById("main-content")

  // Templates
  const browseTemplate = document.getElementById("browse-template")
  const passwordDetailTemplate = document.getElementById("password-detail-template")

  // Current view state
  let currentView = "browse"
  let currentPasswordId = null

  // Initialize the app
  init()

  function init() {
    // Load the browse view by default
    showBrowseView()

    // Set up event listeners
    browseBtn.addEventListener("click", () => {
      setActiveNavButton(browseBtn)
      showBrowseView()
    })

    favoritesBtn.addEventListener("click", () => {
      setActiveNavButton(favoritesBtn)
      showFavoritesView()
    })

    settingsBtn.addEventListener("click", () => {
      setActiveNavButton(settingsBtn)
      showSettingsView()
    })

    // Search functionality
    const searchInput = document.getElementById("search-input")
    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase()
      if (currentView === "browse") {
        filterSavedSites(searchTerm)
      }
    })
  }

  function setActiveNavButton(activeBtn) {
    // Remove active class from all buttons
    ;[browseBtn, favoritesBtn, settingsBtn].forEach((btn) => {
      btn.classList.remove("active")
    })

    // Add active class to the clicked button
    activeBtn.classList.add("active")
  }

  function showBrowseView() {
    currentView = "browse"

    // Clone the browse template
    const browseView = browseTemplate.content.cloneNode(true)

    // Clear main content and append the browse view
    mainContent.innerHTML = ""
    mainContent.appendChild(browseView)

    // Load saved sites
    loadSavedSites()

    // Add event listeners to category items
    const categoryItems = document.querySelectorAll(".category-item")
    categoryItems.forEach((item) => {
      item.addEventListener("click", () => {
        const category = item.dataset.category
        filterSitesByCategory(category)
      })
    })
  }

  function showFavoritesView() {
    currentView = "favorites"

    // Clone the browse template (we'll reuse it for favorites)
    const favoritesView = browseTemplate.content.cloneNode(true)

    // Clear main content and append the favorites view
    mainContent.innerHTML = ""
    mainContent.appendChild(favoritesView)

    // Hide categories in favorites view
    const categoriesContainer = document.querySelector(".categories")
    if (categoriesContainer) {
      categoriesContainer.style.display = "none"
    }

    // Load favorite sites
    loadFavoriteSites()
  }

  function showSettingsView() {
    currentView = "settings"

    // Create settings view
    const settingsView = document.createElement("div")
    settingsView.className = "settings-container"
    settingsView.innerHTML = `
      <h2>Nastavenia</h2>
      <div class="settings-group">
        <h3>Bezpečnosť</h3>
        <div class="setting-item toggle-group">
          <label>Automatické odhlásenie</label>
          <label class="switch">
            <input type="checkbox" id="auto-logout" checked>
            <span class="slider round"></span>
          </label>
        </div>
        <div class="setting-item">
          <label>Čas do odhlásenia</label>
          <select id="logout-time">
            <option value="5">5 minút</option>
            <option value="10">10 minút</option>
            <option value="30" selected>30 minút</option>
            <option value="60">1 hodina</option>
          </select>
        </div>
      </div>
      <div class="settings-group">
        <h3>Generátor hesiel</h3>
        <div class="setting-item toggle-group">
          <label>Zahrnúť veľké písmená</label>
          <label class="switch">
            <input type="checkbox" id="include-uppercase" checked>
            <span class="slider round"></span>
          </label>
        </div>
        <div class="setting-item toggle-group">
          <label>Zahrnúť čísla</label>
          <label class="switch">
            <input type="checkbox" id="include-numbers" checked>
            <span class="slider round"></span>
          </label>
        </div>
        <div class="setting-item toggle-group">
          <label>Zahrnúť špeciálne znaky</label>
          <label class="switch">
            <input type="checkbox" id="include-symbols" checked>
            <span class="slider round"></span>
          </label>
        </div>
        <div class="setting-item">
          <label>Dĺžka hesla</label>
          <input type="range" id="password-length" min="8" max="32" value="16">
          <span id="password-length-value">16</span>
        </div>
      </div>
    `

    // Clear main content and append the settings view
    mainContent.innerHTML = ""
    mainContent.appendChild(settingsView)

    // Add event listeners for settings
    const passwordLengthSlider = document.getElementById("password-length")
    const passwordLengthValue = document.getElementById("password-length-value")

    passwordLengthSlider.addEventListener("input", (e) => {
      passwordLengthValue.textContent = e.target.value
    })
  }

  function showPasswordDetailView(passwordId) {
    currentPasswordId = passwordId

    // Get password data
    const passwordData = getPasswordById(passwordId)
    if (!passwordData) return

    // Clone the password detail template
    const detailView = passwordDetailTemplate.content.cloneNode(true)

    // Fill in the data
    const siteLogo = detailView.querySelector(".site-logo")
    const siteName = detailView.querySelector(".site-name")
    const usernameField = detailView.querySelector("#username-field")
    const passwordField = detailView.querySelector("#password-field")
    const websiteField = detailView.querySelector("#website-field")
    const noteField = detailView.querySelector("#note-field")
    const favoriteToggle = detailView.querySelector("#favorite-toggle")
    const selectedFolder = detailView.querySelector("#selected-folder")

    siteLogo.src = getFaviconUrl(passwordData.website)
    siteLogo.alt = `${passwordData.name} logo`
    siteName.textContent = passwordData.name
    usernameField.value = passwordData.username
    passwordField.value = passwordData.password
    websiteField.value = passwordData.website
    noteField.value = passwordData.note || ""
    favoriteToggle.checked = passwordData.favorite || false
    selectedFolder.textContent = passwordData.folder || "Vybrať priečinok"

    // Clear main content and append the detail view
    mainContent.innerHTML = ""
    mainContent.appendChild(detailView)

    // Add event listeners
    const togglePasswordBtn = document.querySelector(".toggle-password-btn")
    togglePasswordBtn.addEventListener("click", () => {
      if (passwordField.type === "password") {
        passwordField.type = "text"
        togglePasswordBtn.querySelector(".material-symbols-rounded").textContent = "visibility_off"
      } else {
        passwordField.type = "password"
        togglePasswordBtn.querySelector(".material-symbols-rounded").textContent = "visibility"
      }
    })

    const copyBtns = document.querySelectorAll(".copy-btn")
    copyBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const field = btn.dataset.field
        const value = field === "username" ? usernameField.value : passwordField.value
        copyToClipboard(value)
        showToast("Skopírované do schránky")
      })
    })

    const openSiteBtn = document.querySelector(".open-site-btn")
    openSiteBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: ensureHttpPrefix(websiteField.value) })
    })

    const backBtn = document.getElementById("back-btn")
    backBtn.addEventListener("click", () => {
      if (currentView === "favorites") {
        showFavoritesView()
      } else {
        showBrowseView()
      }
    })

    const editBtn = document.getElementById("edit-btn")
    editBtn.addEventListener("click", () => {
      enableEditMode()
    })

    const deleteBtn = document.getElementById("delete-btn")
    deleteBtn.addEventListener("click", () => {
      if (confirm("Naozaj chcete vymazať tento záznam?")) {
        deletePassword(passwordId)
        if (currentView === "favorites") {
          showFavoritesView()
        } else {
          showBrowseView()
        }
      }
    })

    favoriteToggle.addEventListener("change", () => {
      updatePasswordFavorite(passwordId, favoriteToggle.checked)
    })
  }

  function enableEditMode() {
    const usernameField = document.getElementById("username-field")
    const passwordField = document.getElementById("password-field")
    const websiteField = document.getElementById("website-field")
    const noteField = document.getElementById("note-field")

    // Make fields editable
    usernameField.readOnly = false
    passwordField.readOnly = false
    websiteField.readOnly = false
    noteField.readOnly = false

    // Change edit button to save button
    const editBtn = document.getElementById("edit-btn")
    editBtn.innerHTML = '<span class="material-symbols-rounded">save</span> Uložiť'
    editBtn.removeEventListener("click", enableEditMode)
    editBtn.addEventListener("click", saveChanges)
  }

  function saveChanges() {
    const usernameField = document.getElementById("username-field")
    const passwordField = document.getElementById("password-field")
    const websiteField = document.getElementById("website-field")
    const noteField = document.getElementById("note-field")
    const favoriteToggle = document.getElementById("favorite-toggle")

    // Update password data
    updatePassword(currentPasswordId, {
      username: usernameField.value,
      password: passwordField.value,
      website: websiteField.value,
      note: noteField.value,
      favorite: favoriteToggle.checked,
    })

    // Make fields readonly again
    usernameField.readOnly = true
    passwordField.readOnly = true
    websiteField.readOnly = true
    noteField.readOnly = true

    // Change save button back to edit button
    const editBtn = document.getElementById("edit-btn")
    editBtn.innerHTML = '<span class="material-symbols-rounded">edit</span> Upraviť'
    editBtn.removeEventListener("click", saveChanges)
    editBtn.addEventListener("click", enableEditMode)

    showToast("Zmeny boli uložené")
  }

  function loadSavedSites() {
    const savedSitesContainer = document.querySelector(".saved-sites")
    if (!savedSitesContainer) return

    // Clear container
    savedSitesContainer.innerHTML = ""

    // Get saved passwords
    const passwords = getSavedPasswords()

    if (passwords.length === 0) {
      savedSitesContainer.innerHTML = '<p class="empty-state">Nemáte uložené žiadne heslá</p>'
      return
    }

    // Create site items
    passwords.forEach((password) => {
      const siteItem = createSiteItem(password)
      savedSitesContainer.appendChild(siteItem)
    })
  }

  function loadFavoriteSites() {
    const savedSitesContainer = document.querySelector(".saved-sites")
    if (!savedSitesContainer) return

    // Clear container
    savedSitesContainer.innerHTML = ""

    // Get favorite passwords
    const passwords = getSavedPasswords().filter((p) => p.favorite)

    if (passwords.length === 0) {
      savedSitesContainer.innerHTML = '<p class="empty-state">Nemáte žiadne obľúbené heslá</p>'
      return
    }

    // Create site items
    passwords.forEach((password) => {
      const siteItem = createSiteItem(password)
      savedSitesContainer.appendChild(siteItem)
    })
  }

  function filterSavedSites(searchTerm) {
    const savedSitesContainer = document.querySelector(".saved-sites")
    if (!savedSitesContainer) return

    // Clear container
    savedSitesContainer.innerHTML = ""

    // Get saved passwords that match the search term
    const passwords = getSavedPasswords().filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.username.toLowerCase().includes(searchTerm) ||
        p.website.toLowerCase().includes(searchTerm),
    )

    if (passwords.length === 0) {
      savedSitesContainer.innerHTML = '<p class="empty-state">Žiadne výsledky pre "' + searchTerm + '"</p>'
      return
    }

    // Create site items
    passwords.forEach((password) => {
      const siteItem = createSiteItem(password)
      savedSitesContainer.appendChild(siteItem)
    })
  }

  function filterSitesByCategory(category) {
    const savedSitesContainer = document.querySelector(".saved-sites")
    if (!savedSitesContainer) return

    // Clear container
    savedSitesContainer.innerHTML = ""

    // Get saved passwords in the selected category
    const passwords = getSavedPasswords().filter((p) => p.category === category)

    if (passwords.length === 0) {
      savedSitesContainer.innerHTML = '<p class="empty-state">Žiadne heslá v tejto kategórii</p>'
      return
    }

    // Create site items
    passwords.forEach((password) => {
      const siteItem = createSiteItem(password)
      savedSitesContainer.appendChild(siteItem)
    })
  }

  function createSiteItem(password) {
    const siteItem = document.createElement("div")
    siteItem.className = "site-item"
    siteItem.dataset.id = password.id

    siteItem.innerHTML = `
      <img src="${getFaviconUrl(password.website)}" alt="${password.name} logo" class="site-logo">
      <div class="site-info">
        <div class="site-name">${password.name}</div>
        <div class="site-url">${password.username}</div>
      </div>
    `

    siteItem.addEventListener("click", () => {
      showPasswordDetailView(password.id)
    })

    return siteItem
  }

  // Helper functions
  function getFaviconUrl(url) {
    // Extract domain from URL
    let domain = url
    if (url.includes("://")) {
      domain = url.split("://")[1]
    }
    if (domain.includes("/")) {
      domain = domain.split("/")[0]
    }

    // Return Google's favicon service URL
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  }

  function ensureHttpPrefix(url) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return "https://" + url
    }
    return url
  }

  function copyToClipboard(text) {
    const textarea = document.createElement("textarea")
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  }

  function showToast(message) {
    const toast = document.createElement("div")
    toast.className = "toast"
    toast.textContent = message

    document.body.appendChild(toast)

    setTimeout(() => {
      toast.classList.add("show")
    }, 10)

    setTimeout(() => {
      toast.classList.remove("show")
      setTimeout(() => {
        document.body.removeChild(toast)
      }, 300)
    }, 3000)
  }

  // Data storage functions
  function getSavedPasswords() {
    const passwords = localStorage.getItem("passwords")
    return passwords ? JSON.parse(passwords) : getDemoPasswords()
  }

  function getPasswordById(id) {
    const passwords = getSavedPasswords()
    return passwords.find((p) => p.id === id)
  }

  function updatePassword(id, data) {
    const passwords = getSavedPasswords()
    const index = passwords.findIndex((p) => p.id === id)

    if (index !== -1) {
      passwords[index] = { ...passwords[index], ...data }
      localStorage.setItem("passwords", JSON.stringify(passwords))
    }
  }

  function updatePasswordFavorite(id, isFavorite) {
    updatePassword(id, { favorite: isFavorite })
  }

  function deletePassword(id) {
    let passwords = getSavedPasswords()
    passwords = passwords.filter((p) => p.id !== id)
    localStorage.setItem("passwords", JSON.stringify(passwords))
  }

  function getDemoPasswords() {
    return [
      {
        id: "1",
        name: "Facebook",
        username: "a.novakova@gmail.com",
        password: "Jazvec-Spánok-Skrytý0",
        website: "facebook.com",
        category: "social",
        favorite: true,
        folder: "Sociálne siete",
      },
      {
        id: "2",
        name: "Google",
        username: "aaa@gmail.com",
        password: "abcabc",
        website: "google.com",
        category: "social",
        favorite: false,
        folder: "Práca",
        note: "I shared this with my son",
      },
      {
        id: "3",
        name: "Tatra Banka",
        username: "novak.jan",
        password: "Silne-Heslo-123",
        website: "tatrabanka.sk",
        category: "bank",
        favorite: true,
        folder: "Banky",
      },
    ]
  }

  // Declare chrome variable if it's not already defined
  if (typeof chrome === "undefined") {
    chrome = {}
  }
})
