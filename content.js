// Global variables
let passwordFields = []
let usernameFields = []
let formFields = []
const currentDomain = window.location.hostname
let isRegistrationPage = false
let isLoginPage = false

// Zmeniť inicializáciu z DOMContentLoaded na load, pretože Facebook dynamicky načítava obsah
document.addEventListener("DOMContentLoaded", () => {
  // Detect forms and fields
  detectForms()

  // Check if this is a login or registration page
  analyzePageType()

  // Set up event listeners
  setupEventListeners()

  // Check if we have saved passwords for this domain
  checkSavedPasswords()
})

// Nahradiť za:

// Inicializácia - spustí sa ihneď a potom znova po načítaní stránky
initializeExtension()

// Spustí sa aj po načítaní stránky
window.addEventListener("load", () => {
  console.log("Window loaded, initializing extension")
  setTimeout(initializeExtension, 500) // Pridané oneskorenie pre lepšiu kompatibilitu s Facebookom
})

// Hlavná inicializačná funkcia
function initializeExtension() {
  console.log("Initializing password manager extension")
  // Detect forms and fields
  detectForms()

  // Check if this is a login or registration page
  analyzePageType()

  // Set up event listeners
  setupEventListeners()

  // Check if we have saved passwords for this domain
  checkSavedPasswords()
}

// Upraviť funkciu detectForms() pre lepšiu detekciu Facebook formulárov

function detectForms() {
  console.log("Detecting forms on page:", window.location.href)

  // Vyčistíme existujúce polia
  formFields = []
  passwordFields = []
  usernameFields = []

  // Špeciálna detekcia pre Facebook
  if (window.location.hostname.includes("facebook.com")) {
    console.log("Facebook detected, using specialized form detection")
    detectFacebookForms()
    return
  }

  // Štandardná detekcia pre ostatné stránky
  const forms = document.querySelectorAll("form")
  console.log("Found forms:", forms.length)

  forms.forEach((form) => {
    // Find password fields
    const passwordInputs = form.querySelectorAll('input[type="password"]')

    if (passwordInputs.length > 0) {
      formFields.push({
        form: form,
        passwordFields: Array.from(passwordInputs),
        usernameField: findUsernameField(form, passwordInputs[0]),
      })

      // Add to global arrays
      passwordFields = [...passwordFields, ...Array.from(passwordInputs)]
      if (formFields[formFields.length - 1].usernameField) {
        usernameFields.push(formFields[formFields.length - 1].usernameField)
      }
    }
  })

  // If no forms with password fields were found, look for standalone password fields
  if (formFields.length === 0) {
    const standalonePasswordFields = document.querySelectorAll('input[type="password"]')
    console.log("Found standalone password fields:", standalonePasswordFields.length)

    standalonePasswordFields.forEach((passwordField) => {
      const usernameField = findNearbyUsernameField(passwordField)

      formFields.push({
        form: passwordField.closest("form") || null,
        passwordFields: [passwordField],
        usernameField: usernameField,
      })

      passwordFields.push(passwordField)
      if (usernameField) {
        usernameFields.push(usernameField)
      }
    })
  }

  console.log("Detected form fields:", formFields.length)
  console.log("Detected password fields:", passwordFields.length)
}

// Pridať novú funkciu pre detekciu Facebook formulárov
function detectFacebookForms() {
  console.log("Detecting Facebook forms")

  // Facebook login - presné selektory podľa poskytnutého HTML
  const emailInput = document.querySelector(
    'input[name="email"], input[id="email"], input.inputtext[aria-label="Email address or phone number"]',
  )
  const passwordInput = document.querySelector(
    'input[name="pass"], input[id="pass"], input.inputtext[aria-label="Password"]',
  )

  // Facebook registrácia
  const registrationPasswordInput = document.querySelector(
    'input[name="reg_passwd__"], input[id="password_step_input"], input[data-type="password"][autocomplete="new-password"]',
  )

  console.log("Facebook form elements:", {
    emailInput: emailInput ? "found" : "not found",
    passwordInput: passwordInput ? "found" : "not found",
    registrationPasswordInput: registrationPasswordInput ? "found" : "not found",
  })

  // Prihlasovací formulár
  if (emailInput && passwordInput) {
    const loginForm = emailInput.closest("form") || passwordInput.closest("form") || document.querySelector("form")

    formFields.push({
      form: loginForm,
      passwordFields: [passwordInput],
      usernameField: emailInput,
    })

    passwordFields.push(passwordInput)
    usernameFields.push(emailInput)

    console.log("Facebook login form detected")
  }

  // Registračný formulár
  if (registrationPasswordInput) {
    const regForm = registrationPasswordInput.closest("form") || document.querySelector("form")
    const firstNameInput = document.querySelector('input[name="firstname"]')
    const lastNameInput = document.querySelector('input[name="lastname"]')
    const emailRegInput = document.querySelector('input[name="reg_email__"]')

    formFields.push({
      form: regForm,
      passwordFields: [registrationPasswordInput],
      usernameField: emailRegInput || firstNameInput,
    })

    passwordFields.push(registrationPasswordInput)
    if (emailRegInput) usernameFields.push(emailRegInput)

    console.log("Facebook registration form detected")
  }
}

// Try to find the username field associated with a password field
function findUsernameField(form, passwordField) {
  // Look for common username field types
  const usernameSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[id*="email"]',
    'input[name*="email"]',
    'input[name="username"]',
    'input[id*="username"]',
    'input[name*="username"]',
    'input[name="user"]',
    'input[id*="user"]',
    'input[name*="user"]',
    'input[type="text"]',
  ]

  for (const selector of usernameSelectors) {
    const fields = form.querySelectorAll(selector)
    if (fields.length > 0) {
      // Prefer fields that come before the password field
      for (const field of fields) {
        if (field.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING) {
          return field
        }
      }
      // If no field comes before the password, take the first one
      return fields[0]
    }
  }

  return null
}

// Find a username field near a standalone password field
function findNearbyUsernameField(passwordField) {
  // Look for input fields that are siblings or nearby
  const usernameSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[id*="email"]',
    'input[name*="email"]',
    'input[name="username"]',
    'input[id*="username"]',
    'input[name*="username"]',
    'input[name="user"]',
    'input[id*="user"]',
    'input[name*="user"]',
    'input[type="text"]',
  ]

  // Check parent and siblings
  const parent = passwordField.parentElement
  if (!parent) return null

  for (const selector of usernameSelectors) {
    const fields = parent.querySelectorAll(selector)
    if (fields.length > 0) {
      // Prefer fields that come before the password field
      for (const field of fields) {
        if (field.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING) {
          return field
        }
      }
      // If no field comes before the password, take the first one
      return fields[0]
    }
  }

  // Check nearby elements (go up one level and search)
  const grandparent = parent.parentElement
  if (!grandparent) return null

  for (const selector of usernameSelectors) {
    const fields = grandparent.querySelectorAll(selector)
    if (fields.length > 0) {
      // Prefer fields that come before the password field
      for (const field of fields) {
        if (field.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING) {
          return field
        }
      }
      // If no field comes before the password, take the first one
      return fields[0]
    }
  }

  return null
}

// Analyze if the page is likely a login or registration page
function analyzePageType() {
  console.log("Analyzing page type for:", window.location.href)

  // Reset page type
  isRegistrationPage = false
  isLoginPage = false

  // Špeciálna detekcia pre Facebook
  if (window.location.hostname.includes("facebook.com")) {
    analyzeFacebookPageType()
    return
  }

  // Štandardná detekcia pre ostatné stránky
  const url = window.location.href.toLowerCase()
  const urlIndicators = {
    registration: ["register", "signup", "sign-up", "join", "create-account", "registration", "r.php"],
    login: ["login", "log-in", "signin", "sign-in", "authenticate", "login.php"],
  }

  // Check URL for indicators
  for (const indicator of urlIndicators.registration) {
    if (url.includes(indicator)) {
      isRegistrationPage = true
      console.log("Registration page detected via URL:", indicator)
      break
    }
  }

  for (const indicator of urlIndicators.login) {
    if (url.includes(indicator)) {
      isLoginPage = true
      console.log("Login page detected via URL:", indicator)
      break
    }
  }

  // If URL analysis is inconclusive, check page content
  if (!isRegistrationPage && !isLoginPage) {
    // Check for registration indicators in the page
    const registrationTexts = ["register", "sign up", "create account", "join now", "vytvoriť účet"]
    const pageText = document.body.innerText.toLowerCase()

    for (const text of registrationTexts) {
      if (pageText.includes(text)) {
        isRegistrationPage = true
        console.log("Registration page detected via text:", text)
        break
      }
    }

    // Check for multiple password fields (common in registration forms)
    if (passwordFields.length >= 2) {
      isRegistrationPage = true
      console.log("Registration page detected via multiple password fields")
    }

    // Check for login indicators
    const loginTexts = ["log in", "sign in", "login", "prihlásiť", "prihlásenie"]
    for (const text of loginTexts) {
      if (pageText.includes(text)) {
        isLoginPage = true
        console.log("Login page detected via text:", text)
        break
      }
    }
  }

  console.log("Page type analysis result:", { isLoginPage, isRegistrationPage })
}

// Pridať novú funkciu pre detekciu typu stránky na Facebooku
function analyzeFacebookPageType() {
  const url = window.location.href.toLowerCase()

  // Detekcia podľa URL
  if (url.includes("facebook.com/r.php") || url.includes("facebook.com/reg/")) {
    isRegistrationPage = true
    console.log("Facebook registration page detected via URL")
    return
  }

  if (url.includes("facebook.com/login") || url.includes("login.php")) {
    isLoginPage = true
    console.log("Facebook login page detected via URL")
    return
  }

  // Detekcia podľa titulku stránky
  const pageTitle = document.title.toLowerCase()
  if (pageTitle.includes("sign up") || pageTitle.includes("create account") || pageTitle.includes("register")) {
    isRegistrationPage = true
    console.log("Facebook registration page detected via title")
    return
  }

  if (pageTitle.includes("log in") || pageTitle.includes("login")) {
    isLoginPage = true
    console.log("Facebook login page detected via title")
    return
  }

  // Detekcia podľa formulárových prvkov
  const registrationPasswordInput = document.querySelector(
    'input[name="reg_passwd__"], input[id="password_step_input"]',
  )
  if (registrationPasswordInput) {
    isRegistrationPage = true
    console.log("Facebook registration page detected via form elements")
    return
  }

  const loginPasswordInput = document.querySelector('input[name="pass"], input[id="pass"]')
  const loginButton = document.querySelector('button[name="login"], button[id="loginbutton"]')
  if (loginPasswordInput && loginButton) {
    isLoginPage = true
    console.log("Facebook login page detected via form elements")
    return
  }

  // Ak sa nepodarilo detekovať, skúsime podľa textu na stránke
  const pageText = document.body.innerText.toLowerCase()
  if (pageText.includes("create a new account") || pageText.includes("sign up for facebook")) {
    isRegistrationPage = true
    console.log("Facebook registration page detected via page text")
    return
  }

  if (
    pageText.includes("log in to facebook") ||
    (pageText.includes("email or phone") && pageText.includes("password"))
  ) {
    isLoginPage = true
    console.log("Facebook login page detected via page text")
    return
  }

  console.log("Could not determine Facebook page type, defaulting to login page")
  isLoginPage = true // Predvolene považujeme stránku za prihlasovaciu
}

// Set up event listeners for the detected fields
function setupEventListeners() {
  console.log("Setting up event listeners")

  // Listen for password field focus to show suggestions
  passwordFields.forEach((field) => {
    field.removeEventListener("focus", handlePasswordFieldFocus) // Odstránime existujúci listener
    field.addEventListener("focus", handlePasswordFieldFocus)
    console.log("Added focus listener to password field", field)
  })

  // Listen for form submissions to capture credentials
  formFields.forEach((formData) => {
    if (formData.form) {
      formData.form.removeEventListener("submit", handleFormSubmitWrapper) // Odstránime existujúci listener
      formData.form.addEventListener("submit", handleFormSubmitWrapper)
      console.log("Added submit listener to form", formData.form)
    }
  })

  // Špeciálna podpora pre Facebook
  if (window.location.hostname.includes("facebook.com")) {
    setupFacebookEventListeners()
  }

  // Pridáme mutation observer pre detekciu dynamických zmien v DOM
  setupMutationObserver()
}

// Wrapper pre handleFormSubmit, aby sme mohli odstrániť listener
function handleFormSubmitWrapper(e) {
  const formData = formFields.find((f) => f.form === e.currentTarget)
  if (formData) {
    handleFormSubmit(e, formData)
  }
}

// Špeciálna funkcia pre nastavenie event listenerov na Facebooku
function setupFacebookEventListeners() {
  console.log("Setting up Facebook-specific event listeners")

  // Prihlasovací formulár - tlačidlo Login
  const loginButton = document.querySelector('button[name="login"], button[id="loginbutton"], button[type="submit"]')
  if (loginButton && formFields.length > 0) {
    loginButton.removeEventListener("click", handleFacebookLoginClick)
    loginButton.addEventListener("click", handleFacebookLoginClick)
    console.log("Added click listener to Facebook login button", loginButton)
  }

  // Registračný formulár - tlačidlo Sign Up
  const signupButton = document.querySelector('button[name="websubmit"], button[type="submit"]')
  if (signupButton && isRegistrationPage && formFields.length > 0) {
    signupButton.removeEventListener("click", handleFacebookSignupClick)
    signupButton.addEventListener("click", handleFacebookSignupClick)
    console.log("Added click listener to Facebook signup button", signupButton)
  }

  // Pridáme listenery na zmenu hodnoty polí
  const emailInputs = document.querySelectorAll('input[name="email"], input[id="email"], input[name="reg_email__"]')
  emailInputs.forEach((input) => {
    input.removeEventListener("change", checkSavedPasswordsForEmail)
    input.addEventListener("change", checkSavedPasswordsForEmail)
    console.log("Added change listener to email input", input)
  })
}

// Handler pre kliknutie na prihlasovacie tlačidlo Facebooku
function handleFacebookLoginClick(e) {
  console.log("Facebook login button clicked")
  if (formFields.length > 0) {
    handleFormSubmit(e, formFields[0])
  }
}

// Handler pre kliknutie na registračné tlačidlo Facebooku
function handleFacebookSignupClick(e) {
  console.log("Facebook signup button clicked")
  if (formFields.length > 0) {
    handleFormSubmit(e, formFields[0])
  }
}

// Kontrola uložených hesiel po zmene emailu
function checkSavedPasswordsForEmail(e) {
  const email = e.target.value
  if (email && email.length > 0) {
    console.log("Email changed, checking saved passwords for:", email)
    checkSavedPasswords()
  }
}

// Nastavenie mutation observera pre sledovanie zmien v DOM
function setupMutationObserver() {
  // Odstránime existujúci observer
  if (window.passwordManagerObserver) {
    window.passwordManagerObserver.disconnect()
  }

  // Vytvoríme nový observer
  window.passwordManagerObserver = new MutationObserver((mutations) => {
    let shouldRedetect = false

    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (
              node.tagName === "FORM" ||
              node.querySelector("form") ||
              node.querySelector('input[type="password"]') ||
              node.querySelector('input[name="email"]') ||
              node.querySelector('input[name="pass"]')
            ) {
              shouldRedetect = true
              break
            }
          }
        }
      }
    })

    if (shouldRedetect) {
      console.log("DOM changed, re-detecting forms")
      setTimeout(initializeExtension, 500)
    }
  })

  // Spustíme observer
  window.passwordManagerObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })

  console.log("Mutation observer set up")
}

// Handle password field focus
function handlePasswordFieldFocus(event) {
  const passwordField = event.target

  console.log("Password field focused", {
    isRegistrationPage,
    url: window.location.href,
    field: passwordField,
  })

  // If this is a registration page, show password suggestion
  if (
    isRegistrationPage ||
    (window.location.hostname.includes("facebook.com") && window.location.href.includes("r.php"))
  ) {
    console.log("Showing password suggestion for registration")
    showPasswordSuggestion(passwordField)
  }
}

// Show password suggestion UI
function showPasswordSuggestion(passwordField) {
  console.log("Showing password suggestion for field:", passwordField)

  // Odstránime existujúce návrhy
  const existingSuggestions = document.querySelectorAll(".password-suggestion")
  existingSuggestions.forEach((el) => el.remove())

  // Generate a secure password
  const securePassword = generateSecurePassword()

  // Create suggestion UI
  const suggestionElement = document.createElement("div")
  suggestionElement.className = "password-suggestion"

  // Špeciálny štýl pre Facebook
  if (window.location.hostname.includes("facebook.com")) {
    suggestionElement.style.zIndex = "9999"
    suggestionElement.style.backgroundColor = "#fff"
    suggestionElement.style.border = "1px solid #dddfe2"
    suggestionElement.style.borderRadius = "3px"
    suggestionElement.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)"
    suggestionElement.style.padding = "10px"
    suggestionElement.style.maxWidth = "300px"
    suggestionElement.style.fontFamily = "Helvetica, Arial, sans-serif"
  }

  suggestionElement.innerHTML = `
    <div class="password-suggestion-content">
      <p>Čo takto heslo ${securePassword}?</p>
      <p>Zapamätáme si ho za Vás!</p>
    </div>
    <div class="password-suggestion-actions">
      <button class="password-suggestion-btn">Použiť</button>
    </div>
  `

  // Position the suggestion near the password field
  const fieldRect = passwordField.getBoundingClientRect()
  suggestionElement.style.position = "absolute"
  suggestionElement.style.left = `${fieldRect.left}px`
  suggestionElement.style.top = `${fieldRect.bottom + window.scrollY + 5}px`

  // Add to the page
  document.body.appendChild(suggestionElement)
  console.log("Password suggestion element added to page")

  // Add event listener to the "Use" button
  const useButton = suggestionElement.querySelector(".password-suggestion-btn")
  useButton.addEventListener("click", () => {
    console.log("Password suggestion accepted")

    // Fill the password field
    passwordField.value = securePassword

    // Trigger input event to notify Facebook o zmene
    const inputEvent = new Event("input", { bubbles: true })
    passwordField.dispatchEvent(inputEvent)

    // Ak sme na Facebooku, musíme použiť špeciálnu logiku
    if (window.location.hostname.includes("facebook.com")) {
      // Pre Facebook registráciu
      const confirmPasswordField = document.querySelector('input[name="reg_passwd_confirmation"]')
      if (confirmPasswordField) {
        confirmPasswordField.value = securePassword
        confirmPasswordField.dispatchEvent(new Event("input", { bubbles: true }))
      }
    } else {
      // Štandardná logika pre ostatné stránky
      // If there's a second password field (confirm password), fill that too
      const formData = formFields.find((f) => f.passwordFields.includes(passwordField))
      if (formData && formData.passwordFields.length > 1) {
        formData.passwordFields.forEach((field) => {
          if (field !== passwordField) {
            field.value = securePassword
            field.dispatchEvent(new Event("input", { bubbles: true }))
          }
        })
      }
    }

    // Remove the suggestion UI
    document.body.removeChild(suggestionElement)

    // Uložíme heslo pre budúce použitie
  })

  // Remove the suggestion when clicking outside
  document.addEventListener("click", function removeSuggestion(e) {
    if (!suggestionElement.contains(e.target) && e.target !== passwordField) {
      document.body.removeChild(suggestionElement)
      document.removeEventListener("click", removeSuggestion)
    }
  })
}

// Generate a secure password
function generateSecurePassword() {
  const adjectives = [
    "Veselý",
    "Smutný",
    "Rýchly",
    "Pomalý",
    "Veľký",
    "Malý",
    "Silný",
    "Slabý",
    "Múdry",
    "Hlúpy",
    "Pekný",
    "Škaredý",
    "Dobrý",
    "Zlý",
    "Nový",
    "Starý",
    "Teplý",
    "Studený",
    "Tvrdý",
    "Mäkký",
    "Jazvec",
    "Líška",
    "Medveď",
    "Vlk",
    "Tiger",
    "Lev",
    "Orol",
    "Sokol",
  ]

  const nouns = [
    "Dom",
    "Auto",
    "Loď",
    "Lietadlo",
    "Počítač",
    "Telefón",
    "Kniha",
    "Pero",
    "Stôl",
    "Stolička",
    "Okno",
    "Dvere",
    "Strom",
    "Kvet",
    "Tráva",
    "Kameň",
    "Voda",
    "Oheň",
    "Vzduch",
    "Zem",
    "Slnko",
    "Mesiac",
    "Hviezda",
    "Obloha",
    "Spánok",
    "Beh",
    "Skok",
    "Tanec",
  ]

  const adjectives2 = [
    "Skrytý",
    "Viditeľný",
    "Tajný",
    "Verejný",
    "Tichý",
    "Hlučný",
    "Jasný",
    "Tmavý",
    "Vysoký",
    "Nízky",
    "Široký",
    "Úzky",
    "Plný",
    "Prázdny",
    "Ťažký",
    "Ľahký",
    "Mokrý",
    "Suchý",
    "Čistý",
    "Špinavý",
    "Horúci",
    "Chladný",
    "Sladký",
    "Horký",
  ]

  // Pick random words
  const adj1 = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const adj2 = adjectives2[Math.floor(Math.random() * adjectives2.length)]

  // Add a random number
  const number = Math.floor(Math.random() * 10)

  // Combine into a password
  return `${adj1}-${noun}-${adj2}${number}`
}

// Handle form submission
function handleFormSubmit(event, formData) {
  // Only save credentials on successful form submission
  // We'll use a timeout to allow the form to submit first
  setTimeout(() => {
    const usernameValue = formData.usernameField ? formData.usernameField.value : ""
    const passwordValue = formData.passwordFields[0].value

    if (usernameValue && passwordValue) {
      // Determine if this is a new registration or a login
      if (isRegistrationPage) {
        // Save the new credentials
        saveNewCredentials(usernameValue, passwordValue)
      } else if (isLoginPage) {
        // Update existing credentials if needed
        updateCredentialsIfNeeded(usernameValue, passwordValue)
      }
    }
  }, 500)
}

// Save new credentials
function saveNewCredentials(username, password) {
  // Get page title or domain as the site name
  const siteName = document.title || currentDomain

  // Prepare data
  const data = {
    name: siteName,
    username: username,
    password: password,
    website: window.location.origin,
    category: determineCategoryFromDomain(currentDomain),
    favorite: false,
    folder: null,
    note: "",
    dateAdded: new Date().toISOString(),
  }

  // Send message to background script to save the password
  chrome.runtime.sendMessage(
    {
      action: "savePassword",
      data: data,
    },
    (response) => {
      console.log("Password saved:", response.success)
    },
  )
}

// Update existing credentials if needed
function updateCredentialsIfNeeded(username, password) {
  // Check if we already have credentials for this domain
  chrome.runtime.sendMessage(
    {
      action: "getPasswordsForDomain",
      domain: currentDomain,
    },
    (response) => {
      if (response.success && response.passwords.length > 0) {
        // Check if the username matches any existing entry
        const matchingEntry = response.passwords.find((p) => p.username === username)

        if (matchingEntry) {
          // If password is different, update it
          if (matchingEntry.password !== password) {
            // Update the password
            matchingEntry.password = password
            matchingEntry.dateModified = new Date().toISOString()

            chrome.runtime.sendMessage(
              {
                action: "updatePassword",
                data: matchingEntry,
              },
              (updateResponse) => {
                console.log("Password updated:", updateResponse.success)
              },
            )
          }
        } else {
          // This is a new username for this domain, save it
          saveNewCredentials(username, password)
        }
      } else {
        // No existing credentials for this domain, save as new
        saveNewCredentials(username, password)
      }
    },
  )
}

// Upraviť funkciu checkSavedPasswords() pre lepšiu podporu Facebooku

function checkSavedPasswords() {
  console.log("Checking saved passwords for domain:", currentDomain)

  if (isLoginPage || (window.location.hostname.includes("facebook.com") && !isRegistrationPage)) {
    chrome.runtime.sendMessage(
      {
        action: "getPasswordsForDomain",
        domain: currentDomain,
      },
      (response) => {
        console.log("Got response from background script:", response ? "success" : "error")

        if (response && response.success && response.passwords && response.passwords.length > 0) {
          console.log("Found saved passwords:", response.passwords.length)

          // Ak sme na Facebooku, použijeme špeciálnu logiku
          if (window.location.hostname.includes("facebook.com")) {
            handleFacebookSavedPasswords(response.passwords)
          } else {
            // Štandardná logika pre ostatné stránky
            if (response.passwords.length === 1) {
              // Only one password, offer to autofill
              offerAutofill(response.passwords[0])
            } else {
              // Multiple passwords, offer to choose
              offerPasswordSelection(response.passwords)
            }
          }
        } else {
          console.log("No saved passwords found or error in response")
        }
      },
    )
  } else if (isRegistrationPage) {
    // Pre registračnú stránku ponúkneme generovanie hesla
    const passwordField = passwordFields[0]
    if (passwordField) {
      console.log("Registration page detected, offering password generation")
      showPasswordSuggestion(passwordField)
    }
  }
}

// Špeciálna funkcia pre prácu s uloženými heslami na Facebooku
function handleFacebookSavedPasswords(passwords) {
  console.log("Handling Facebook saved passwords")

  // Nájdeme formulárové prvky
  const emailInput = document.querySelector('input[name="email"], input[id="email"]')
  const passwordInput = document.querySelector('input[name="pass"], input[id="pass"]')

  if (!emailInput || !passwordInput) {
    console.log("Could not find Facebook login form elements")
    return
  }

  // Ak už je email vyplnený, skúsime nájsť zodpovedajúce heslo
  if (emailInput.value && emailInput.value.length > 0) {
    const matchingPassword = passwords.find((p) => p.username === emailInput.value)
    if (matchingPassword) {
      console.log("Found matching password for email:", emailInput.value)
      offerAutofill(matchingPassword)
      return
    }
  }

  // Inak ponúkneme všetky uložené heslá
  if (passwords.length === 1) {
    offerAutofill(passwords[0])
  } else {
    offerPasswordSelection(passwords)
  }
}

// Check if we have saved passwords for this domain
//function checkSavedPasswords() {
//  if (isLoginPage || window.location.hostname.includes("facebook.com")) {
//    console.log("Checking saved passwords for domain:", currentDomain)
//    chrome.runtime.sendMessage(
//      {
//        action: "getPasswordsForDomain",
//        domain: currentDomain,
//      },
//      (response) => {
//        if (response && response.success && response.passwords && response.passwords.length > 0) {
//          // We have saved passwords for this domain
//          console.log("Found saved passwords:", response.passwords.length)
//          if (response.passwords.length === 1) {
//            // Only one password, offer to autofill
//            offerAutofill(response.passwords[0])
//          } else {
//            // Multiple passwords, offer to choose
//            offerPasswordSelection(response.passwords)
//          }
//        } else {
//          console.log("No saved passwords found or error in response", response)
//        }
//      },
//    )
//  }
//}

// Offer to autofill a single saved password
function offerAutofill(passwordData) {
  // Find the form to fill
  const formData = formFields[0] // Use the first form with password field

  if (formData) {
    // Create autofill suggestion UI
    const suggestionElement = document.createElement("div")
    suggestionElement.className = "password-suggestion"
    suggestionElement.innerHTML = `
      <div class="password-suggestion-content">
        <p>Chceš sa prihlásiť ako ${passwordData.username}?</p>
        <p>Tvoje heslo máme v bezpečí :)</p>
      </div>
      <div class="password-suggestion-actions">
        <button class="password-suggestion-btn">Použiť</button>
      </div>
    `

    // Position the suggestion near the username field
    const fieldRect = formData.usernameField
      ? formData.usernameField.getBoundingClientRect()
      : formData.passwordFields[0].getBoundingClientRect()

    suggestionElement.style.position = "absolute"
    suggestionElement.style.left = `${fieldRect.left}px`
    suggestionElement.style.top = `${fieldRect.bottom + window.scrollY + 5}px`

    // Add to the page
    document.body.appendChild(suggestionElement)

    // Add event listener to the "Use" button
    const useButton = suggestionElement.querySelector(".password-suggestion-btn")
    useButton.addEventListener("click", () => {
      // Fill the form
      if (formData.usernameField) {
        formData.usernameField.value = passwordData.username
      }

      formData.passwordFields.forEach((field) => {
        field.value = passwordData.password
      })

      // Remove the suggestion UI
      document.body.removeChild(suggestionElement)
    })

    // Remove the suggestion when clicking outside
    document.addEventListener("click", function removeSuggestion(e) {
      if (
        !suggestionElement.contains(e.target) &&
        e.target !== formData.usernameField &&
        !formData.passwordFields.includes(e.target)
      ) {
        document.body.removeChild(suggestionElement)
        document.removeEventListener("click", removeSuggestion)
      }
    })
  }
}

// Offer to select from multiple saved passwords
function offerPasswordSelection(passwords) {
  // Find the form to fill
  const formData = formFields[0] // Use the first form with password field

  if (formData) {
    // Create password selection UI
    const selectionElement = document.createElement("div")
    selectionElement.className = "password-selection"

    let selectionHTML = `
      <div class="password-selection-header">
        <h3>Vyber si účet na prihlásenie</h3>
      </div>
      <div class="password-selection-list">
    `

    passwords.forEach((pwd) => {
      selectionHTML += `
        <div class="password-selection-item" data-username="${pwd.username}" data-password="${pwd.password}">
          <img src="${getFaviconUrl(pwd.website)}" alt="${pwd.name} logo" class="site-logo">
          <div class="selection-info">
            <div class="selection-username">${pwd.username}</div>
            <div class="selection-site">${pwd.name}</div>
          </div>
        </div>
      `
    })

    selectionHTML += `
      </div>
      <div class="password-selection-footer">
        <button class="password-selection-cancel">Zrušiť</button>
      </div>
    `

    selectionElement.innerHTML = selectionHTML

    // Style the selection UI
    selectionElement.style.position = "fixed"
    selectionElement.style.top = "50%"
    selectionElement.style.left = "50%"
    selectionElement.style.transform = "translate(-50%, -50%)"
    selectionElement.style.backgroundColor = "#fff"
    selectionElement.style.borderRadius = "8px"
    selectionElement.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)"
    selectionElement.style.padding = "16px"
    selectionElement.style.zIndex = "10000"
    selectionElement.style.maxWidth = "400px"
    selectionElement.style.width = "90%"

    // Add to the page
    document.body.appendChild(selectionElement)

    // Add backdrop
    const backdrop = document.createElement("div")
    backdrop.className = "password-selection-backdrop"
    backdrop.style.position = "fixed"
    backdrop.style.top = "0"
    backdrop.style.left = "0"
    backdrop.style.right = "0"
    backdrop.style.bottom = "0"
    backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
    backdrop.style.zIndex = "9999"
    document.body.appendChild(backdrop)

    // Add event listeners to selection items
    const selectionItems = selectionElement.querySelectorAll(".password-selection-item")
    selectionItems.forEach((item) => {
      item.addEventListener("click", () => {
        const username = item.dataset.username
        const password = item.dataset.password

        // Fill the form
        if (formData.usernameField) {
          formData.usernameField.value = username
        }

        formData.passwordFields.forEach((field) => {
          field.value = password
        })

        // Remove the selection UI and backdrop
        document.body.removeChild(selectionElement)
        document.body.removeChild(backdrop)
      })
    })

    // Add event listener to the cancel button
    const cancelButton = selectionElement.querySelector(".password-selection-cancel")
    cancelButton.addEventListener("click", () => {
      document.body.removeChild(selectionElement)
      document.body.removeChild(backdrop)
    })

    // Close when clicking on backdrop
    backdrop.addEventListener("click", () => {
      document.body.removeChild(selectionElement)
      document.body.removeChild(backdrop)
    })
  }
}

// Helper function to get favicon URL
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

// Determine category based on domain
function determineCategoryFromDomain(domain) {
  const bankDomains = ["bank", "banka", "banking", "pay", "payment", "finance", "financial"]
  const socialDomains = ["facebook", "twitter", "instagram", "linkedin", "tiktok", "social"]
  const workDomains = ["office", "work", "job", "career", "business", "corporate"]
  const healthDomains = ["health", "hospital", "doctor", "medical", "clinic", "healthcare"]

  domain = domain.toLowerCase()

  for (const bankDomain of bankDomains) {
    if (domain.includes(bankDomain)) {
      return "bank"
    }
  }

  for (const socialDomain of socialDomains) {
    if (domain.includes(socialDomain)) {
      return "social"
    }
  }

  for (const workDomain of workDomains) {
    if (domain.includes(workDomain)) {
      return "work"
    }
  }

  for (const healthDomain of healthDomains) {
    if (domain.includes(healthDomain)) {
      return "health"
    }
  }

  return "other"
}
