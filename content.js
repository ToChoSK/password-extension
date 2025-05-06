// Safely access browser APIs
const browser = window.chrome || window.browser || {}

// Debug mode - set to true to see detailed logs
const DEBUG = true

// Log function that only logs when debug is enabled
function log(...args) {
  if (DEBUG) {
    console.log("[Password Manager]", ...args)
  }
}

// Global state
let state = {
  formFields: [],
  passwordFields: [],
  usernameFields: [],
  isLoginPage: false,
  isRegistrationPage: false,
  currentDomain: window.location.hostname,
  passwordSuggestionShown: false,
  credentialsOffered: false,
  processingForms: false,
}

// Initialize immediately and after page load
initializeExtension()

// Add multiple initialization attempts with increasing delays
window.addEventListener("load", () => {
  log("Window loaded, scheduling multiple detection attempts")
  setTimeout(initializeExtension, 500)
  setTimeout(initializeExtension, 1500)
  setTimeout(initializeExtension, 3000)
})

// Set up a continuous check for Facebook specifically
if (isFacebookDomain()) {
  log("Facebook domain detected, setting up continuous monitoring")
  setInterval(checkFacebookLoginForm, 1000)
}

// Main initialization function
function initializeExtension() {
  if (state.processingForms) {
    log("Already processing forms, skipping this initialization")
    return
  }

  state.processingForms = true
  log("Initializing password manager extension")

  // Reset state but keep track of whether we've shown suggestions
  const passwordSuggestionShown = state.passwordSuggestionShown
  const credentialsOffered = state.credentialsOffered

  state = {
    formFields: [],
    passwordFields: [],
    usernameFields: [],
    isLoginPage: false,
    isRegistrationPage: false,
    currentDomain: window.location.hostname,
    passwordSuggestionShown: passwordSuggestionShown,
    credentialsOffered: credentialsOffered,
    processingForms: true,
  }

  // Detect forms and analyze page type
  detectForms()
  analyzePageType()

  // Set up event listeners and check for saved passwords
  if (state.formFields.length > 0) {
    setupEventListeners()
    checkSavedPasswords()
  }

  // Set up mutation observer to detect dynamically added forms
  setupMutationObserver()

  state.processingForms = false
  log("Initialization complete", state)
}

// Special function to check for Facebook login form
function checkFacebookLoginForm() {
  if (state.credentialsOffered) {
    log("Credentials already offered, skipping Facebook check")
    return
  }

  log("Running special Facebook login form check")

  // Rozšírené selektory pre Facebook login.php stránku
  const emailSelectors = [
    // Pôvodné selektory
    'input[name="email"], input[id="email"], input[placeholder="Email or phone number"], input[placeholder="E-mail alebo telefónne číslo"]',
    'input[data-testid="royal_email"]',
    'input[aria-label="Email or phone number"]',
    'input[aria-label="E-mail alebo telefónne číslo"]',

    // Nové selektory špecifické pre login.php
    'input.inputtext._55r1[name="email"]',
    'input.inputtext._1kbt[name="email"]',
    'input[tabindex="0"][name="email"]',
    'input[autofocus="1"][name="email"]',
    'input[autocomplete="username"][name="email"]',
    'input.inputtext._55r1.inputtext._1kbt.inputtext._1kbt[name="email"]',
  ]

  const passwordSelectors = [
    // Pôvodné selektory
    'input[name="pass"], input[id="pass"], input[placeholder="Password"], input[placeholder="Heslo"]',
    'input[data-testid="royal_pass"]',
    'input[aria-label="Password"]',
    'input[aria-label="Heslo"]',

    // Nové selektory špecifické pre login.php
    'input.inputtext._55r1[name="pass"]',
    'input.inputtext._9npi[name="pass"]',
    'input[tabindex="0"][name="pass"]',
    'input[autocomplete="current-password"][name="pass"]',
    'input.inputtext._55r1.inputtext._9npi.inputtext._9npi[name="pass"]',
  ]

  // Skúsiť nájsť email a heslo pomocou rôznych selektorov
  let emailInput = null
  let passwordInput = null

  // Najprv skúsime priamo selektory pre login.php stránku
  if (window.location.href.includes("login.php")) {
    log("Detected login.php page, using specific selectors")

    emailInput = document.querySelector('input.inputtext._55r1.inputtext._1kbt.inputtext._1kbt[name="email"]')
    passwordInput = document.querySelector('input.inputtext._55r1.inputtext._9npi.inputtext._9npi[name="pass"]')

    // Ak nenájdeme, skúsime základné selektory podľa name a id
    if (!emailInput) emailInput = document.querySelector('input[name="email"]')
    if (!passwordInput) passwordInput = document.querySelector('input[name="pass"]')
  }

  // Ak stále nemáme polia, skúsime všetky selektory
  if (!emailInput || !passwordInput) {
    for (const selector of emailSelectors) {
      const elements = document.querySelectorAll(selector)
      elements.forEach((element) => {
        if (isEmailField(element) && !emailInput) {
          emailInput = element
          log("Found Facebook email field:", element)
        }
      })
      if (emailInput) break
    }

    for (const selector of passwordSelectors) {
      const elements = document.querySelectorAll(selector)
      elements.forEach((element) => {
        if (isPasswordField(element) && !passwordInput) {
          passwordInput = element
          log("Found Facebook password field:", element)
        }
      })
      if (passwordInput) break
    }
  }

  // Ak stále nemáme polia, skúsime nájsť akékoľvek vstupné polia
  if (!emailInput || !passwordInput) {
    const inputs = document.querySelectorAll("input")
    inputs.forEach((input) => {
      const type = input.getAttribute("type")
      const name = input.getAttribute("name")

      if (!emailInput && (name === "email" || type === "email" || type === "text")) {
        emailInput = input
        log("Found potential email field by general search:", input)
      } else if (!passwordInput && (name === "pass" || type === "password")) {
        passwordInput = input
        log("Found potential password field by general search:", input)
      }
    })
  }

  if (emailInput && passwordInput) {
    log("Facebook login form found in special check")

    // Skontrolujeme, či tento formulár už nie je v našom zozname
    const alreadyDetected = state.formFields.some(
      (f) => f.passwordFields.includes(passwordInput) || (f.usernameField && f.usernameField === emailInput),
    )

    if (!alreadyDetected) {
      const loginForm = findFormElement(emailInput, passwordInput)

      state.formFields.push({
        form: loginForm,
        passwordFields: [passwordInput],
        usernameField: emailInput,
      })

      state.passwordFields.push(passwordInput)
      state.usernameFields.push(emailInput)
      state.isLoginPage = true

      // Nastavíme event listeners a skontrolujeme uložené heslá
      setupEventListeners()
      checkSavedPasswords()
    }
  }
}

// Helper function to find the form element containing the inputs
function findFormElement(emailInput, passwordInput) {
  // Try to find the closest form
  const emailForm = emailInput.closest("form")
  const passwordForm = passwordInput.closest("form")

  if (emailForm && passwordForm && emailForm === passwordForm) {
    return emailForm
  }

  if (emailForm) return emailForm
  if (passwordForm) return passwordForm

  // If no form is found, create a virtual form object
  return {
    addEventListener: (event, handler) => {
      // Add event listeners to both inputs to catch submission
      emailInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handler(e)
      })
      passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handler(e)
      })

      // Find submit buttons near the inputs
      const submitButtons = findNearbySubmitButtons(emailInput, passwordInput)
      submitButtons.forEach((button) => {
        button.addEventListener("click", handler)
      })
    },
    querySelector: (selector) => {
      // Simple implementation to support basic form queries
      if (selector.includes('input[type="password"]')) return passwordInput
      if (selector.includes('input[type="email"]') || selector.includes('input[name="email"]')) return emailInput
      return null
    },
    querySelectorAll: (selector) => {
      // Simple implementation to support basic form queries
      const results = []
      if (selector.includes('input[type="password"]')) results.push(passwordInput)
      if (selector.includes('input[type="email"]') || selector.includes('input[name="email"]')) results.push(emailInput)
      return results
    },
    submit: () => {
      // Try to find and click a submit button
      const submitButtons = findNearbySubmitButtons(emailInput, passwordInput)
      if (submitButtons.length > 0) {
        submitButtons[0].click()
      } else {
        // Simulate Enter key on password field as fallback
        const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        passwordInput.dispatchEvent(event)
      }
    },
  }
}

// Find submit buttons near the inputs
function findNearbySubmitButtons(emailInput, passwordInput) {
  const buttons = []

  // Look for common submit button patterns
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[name="login"]',
    "button.login_form_login_button",
    'button[data-testid="royal_login_button"]',
    'button:contains("Log In")',
    'button:contains("Sign In")',
    'button:contains("Prihlásiť")',
  ]

  // Check for buttons in common parent elements
  const parents = [
    emailInput.parentElement,
    emailInput.parentElement?.parentElement,
    emailInput.parentElement?.parentElement?.parentElement,
    passwordInput.parentElement,
    passwordInput.parentElement?.parentElement,
    passwordInput.parentElement?.parentElement?.parentElement,
  ].filter(Boolean)

  // Add document body as the final fallback
  parents.push(document.body)

  // Search for buttons in each parent
  for (const parent of parents) {
    for (const selector of submitSelectors) {
      try {
        const elements = parent.querySelectorAll(selector)
        elements.forEach((el) => {
          if (!buttons.includes(el) && isVisibleElement(el)) {
            buttons.push(el)
          }
        })
      } catch (e) {
        // Some selectors might not be supported, ignore errors
      }
    }

    // Also look for elements that look like buttons
    const potentialButtons = parent.querySelectorAll('button, input[type="button"], a.button, div[role="button"]')
    potentialButtons.forEach((el) => {
      if (
        !buttons.includes(el) &&
        isVisibleElement(el) &&
        (el.textContent?.toLowerCase().includes("log in") ||
          el.textContent?.toLowerCase().includes("sign in") ||
          el.textContent?.toLowerCase().includes("prihlásiť"))
      ) {
        buttons.push(el)
      }
    })
  }

  return buttons
}

// Check if an element is visible
function isVisibleElement(element) {
  if (!element) return false

  const style = window.getComputedStyle(element)
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  )
}

// Detect forms on the page
function detectForms() {
  log("Detecting forms on page:", window.location.href)

  // Special handling for Facebook
  if (isFacebookDomain()) {
    log("Facebook detected, using specialized form detection")
    detectFacebookForms()
    return
  }

  // Standard form detection for other sites
  const forms = document.querySelectorAll("form")
  log("Found forms:", forms.length)

  forms.forEach((form) => {
    const passwordInputs = form.querySelectorAll('input[type="password"]')
    if (passwordInputs.length > 0) {
      const formData = {
        form: form,
        passwordFields: Array.from(passwordInputs),
        usernameField: findUsernameField(form, passwordInputs[0]),
      }

      state.formFields.push(formData)
      state.passwordFields = [...state.passwordFields, ...Array.from(passwordInputs)]

      if (formData.usernameField) {
        state.usernameFields.push(formData.usernameField)
      }
    }
  })

  // If no forms with password fields were found, look for standalone password fields
  if (state.formFields.length === 0) {
    const standalonePasswordFields = document.querySelectorAll('input[type="password"]')
    log("Found standalone password fields:", standalonePasswordFields.length)

    standalonePasswordFields.forEach((passwordField) => {
      const usernameField = findNearbyUsernameField(passwordField)
      const formData = {
        form: passwordField.closest("form") || createVirtualForm(passwordField, usernameField),
        passwordFields: [passwordField],
        usernameField: usernameField,
      }

      state.formFields.push(formData)
      state.passwordFields.push(passwordField)

      if (usernameField) {
        state.usernameFields.push(usernameField)
      }
    })
  }

  log("Detected form fields:", state.formFields.length)
  log("Detected password fields:", state.passwordFields.length)
}

// Create a virtual form for standalone fields
function createVirtualForm(passwordField, usernameField) {
  return {
    addEventListener: (event, handler) => {
      // Add event listeners to inputs to catch submission
      passwordField.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handler(e)
      })

      if (usernameField) {
        usernameField.addEventListener("keydown", (e) => {
          if (e.key === "Enter") handler(e)
        })
      }

      // Find submit buttons near the inputs
      const submitButtons = findNearbySubmitButtons(usernameField || passwordField, passwordField)
      submitButtons.forEach((button) => {
        button.addEventListener("click", handler)
      })
    },
    querySelector: (selector) => {
      // Simple implementation to support basic form queries
      if (selector.includes('input[type="password"]')) return passwordField
      if (usernameField && (selector.includes('input[type="email"]') || selector.includes('input[name="email"]')))
        return usernameField
      return null
    },
    querySelectorAll: (selector) => {
      // Simple implementation to support basic form queries
      const results = []
      if (selector.includes('input[type="password"]')) results.push(passwordField)
      if (usernameField && (selector.includes('input[type="email"]') || selector.includes('input[name="email"]')))
        return usernameField
      return results
    },
    submit: () => {
      // Try to find and click a submit button
      const submitButtons = findNearbySubmitButtons(usernameField || passwordField, passwordField)
      if (submitButtons.length > 0) {
        submitButtons[0].click()
      } else {
        // Simulate Enter key on password field as fallback
        const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
        passwordField.dispatchEvent(event)
      }
    },
  }
}

// Specialized detection for Facebook forms
function detectFacebookForms() {
  log("Detecting Facebook forms")

  // Try multiple selector combinations to find login fields
  const emailSelectors = [
    'input[name="email"]',
    'input[id="email"]',
    'input.inputtext[name="email"]',
    'input[data-testid="royal_email"]',
    'input[aria-label="Email or phone number"]',
    'input[aria-label="E-mail alebo telefónne číslo"]',
    'input[placeholder="Email or phone number"]',
    'input[placeholder="E-mail alebo telefónne číslo"]',
    'input.inputtext._55r1[name="email"]',
    'input.inputtext._1kbt[name="email"]',
  ]

  const passwordSelectors = [
    'input[name="pass"]',
    'input[id="pass"]',
    'input.inputtext[name="pass"]',
    'input[data-testid="royal_pass"]',
    'input[aria-label="Password"]',
    'input[aria-label="Heslo"]',
    'input[placeholder="Password"]',
    'input[placeholder="Heslo"]',
    'input.inputtext._55r1[type="password"]',
    'input.inputtext._9npi[name="pass"]',
  ]

  // Try each combination of selectors
  let emailInput = null
  let passwordInput = null

  // First try to find both fields with the same selector pattern
  for (let i = 0; i < emailSelectors.length && !emailInput; i++) {
    emailInput = document.querySelector(emailSelectors[i])
    if (emailInput && i < passwordSelectors.length) {
      passwordInput = document.querySelector(passwordSelectors[i])
    }
  }

  // If that didn't work, try all combinations
  if (!emailInput || !passwordInput) {
    emailInput = null
    passwordInput = null

    for (const emailSelector of emailSelectors) {
      const email = document.querySelector(emailSelector)
      if (email) {
        for (const passwordSelector of passwordSelectors) {
          const password = document.querySelector(passwordSelector)
          if (password) {
            emailInput = email
            passwordInput = password
            break
          }
        }
        if (emailInput && passwordInput) break
      }
    }
  }

  // Last resort: find any input that looks like email and password
  if (!emailInput || !passwordInput) {
    const inputs = document.querySelectorAll("input")
    inputs.forEach((input) => {
      if (isEmailField(input) && !emailInput) {
        emailInput = input
      } else if (isPasswordField(input) && !passwordInput) {
        passwordInput = input
      }
    })
  }

  // Log what we found
  log("Facebook form elements:", {
    emailInput: emailInput ? truncateHTML(emailInput.outerHTML) : "not found",
    passwordInput: passwordInput ? truncateHTML(passwordInput.outerHTML) : "not found",
  })

  // If we found both fields, add them to our form fields
  if (emailInput && passwordInput) {
    const loginForm = findFormElement(emailInput, passwordInput)

    state.formFields.push({
      form: loginForm,
      passwordFields: [passwordInput],
      usernameField: emailInput,
    })

    state.passwordFields.push(passwordInput)
    state.usernameFields.push(emailInput)
    state.isLoginPage = true

    log("Facebook login form detected")
  }

  // Also check for registration form
  const registrationPasswordInput = document.querySelector(
    'input[name="reg_passwd__"], input[id="password_step_input"], input[data-type="password"][autocomplete="new-password"], input.inputtext[data-type="password"]',
  )

  if (registrationPasswordInput) {
    const regForm = registrationPasswordInput.closest("form") || document.querySelector("form")
    const emailRegInput = document.querySelector('input[name="reg_email__"]')
    const firstNameInput = document.querySelector('input[name="firstname"]')

    state.formFields.push({
      form: regForm,
      passwordFields: [registrationPasswordInput],
      usernameField: emailRegInput || firstNameInput,
    })

    state.passwordFields.push(registrationPasswordInput)

    if (emailRegInput) state.usernameFields.push(emailRegInput)
    else if (firstNameInput) state.usernameFields.push(firstNameInput)

    state.isRegistrationPage = true
    log("Facebook registration form detected")
  }
}

// Helper to truncate HTML for logging
function truncateHTML(html, maxLength = 100) {
  if (!html) return "null"
  if (html.length <= maxLength) return html
  return html.substring(0, maxLength) + "..."
}

// Check if an input is likely an email field
function isEmailField(input) {
  if (!input) return false

  // Check various attributes that suggest this is an email field
  const type = input.getAttribute("type")
  const name = input.getAttribute("name")
  const id = input.getAttribute("id")
  const placeholder = input.getAttribute("placeholder")
  const ariaLabel = input.getAttribute("aria-label")
  const autocomplete = input.getAttribute("autocomplete")

  return (
    type === "email" ||
    name === "email" ||
    (name && name.includes("email")) ||
    id === "email" ||
    (id && id.includes("email")) ||
    (placeholder &&
      (placeholder.toLowerCase().includes("email") ||
        placeholder.toLowerCase().includes("e-mail") ||
        placeholder.toLowerCase().includes("phone"))) ||
    (ariaLabel &&
      (ariaLabel.toLowerCase().includes("email") ||
        ariaLabel.toLowerCase().includes("e-mail") ||
        ariaLabel.toLowerCase().includes("phone"))) ||
    autocomplete === "username" ||
    autocomplete === "email"
  )
}

// Check if an input is likely a password field
function isPasswordField(input) {
  if (!input) return false

  // Check various attributes that suggest this is a password field
  const type = input.getAttribute("type")
  const name = input.getAttribute("name")
  const id = input.getAttribute("id")
  const placeholder = input.getAttribute("placeholder")
  const ariaLabel = input.getAttribute("aria-label")
  const autocomplete = input.getAttribute("autocomplete")

  return (
    type === "password" ||
    name === "pass" ||
    name === "password" ||
    (name && name.includes("password")) ||
    id === "pass" ||
    id === "password" ||
    (id && id.includes("password")) ||
    (placeholder && placeholder.toLowerCase().includes("password")) ||
    (placeholder && placeholder.toLowerCase().includes("heslo")) ||
    (ariaLabel && ariaLabel.toLowerCase().includes("password")) ||
    (ariaLabel && ariaLabel.toLowerCase().includes("heslo")) ||
    autocomplete === "current-password" ||
    autocomplete === "new-password"
  )
}

// Find username field in a form
function findUsernameField(form, passwordField) {
  // Common username field selectors
  const usernameSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[id="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="e-mail" i]',
    'input[placeholder*="username" i]',
    'input[aria-label*="email" i]',
    'input[aria-label*="e-mail" i]',
    'input[aria-label*="username" i]',
    'input[name="username"]',
    'input[id="username"]',
    'input[name*="user"]',
    'input[id*="user"]',
    'input[type="text"]',
  ]

  // Try each selector
  for (const selector of usernameSelectors) {
    try {
      const fields = form.querySelectorAll(selector)
      if (fields.length > 0) {
        // Prefer fields that come before the password field
        for (const field of fields) {
          if (passwordField && field.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING) {
            return field
          }
        }
        // If no field comes before the password, take the first one
        return fields[0]
      }
    } catch (e) {
      // Some selectors might not be supported, ignore errors
    }
  }

  // If no username field found with selectors, look for any visible text input
  const textInputs = form.querySelectorAll('input[type="text"]')
  for (const input of textInputs) {
    if (isVisibleElement(input)) {
      return input
    }
  }

  return null
}

// Find username field near a standalone password field
function findNearbyUsernameField(passwordField) {
  if (!passwordField) return null

  // Look for input fields that are siblings or nearby
  const usernameSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[id="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="e-mail" i]',
    'input[placeholder*="username" i]',
    'input[aria-label*="email" i]',
    'input[aria-label*="e-mail" i]',
    'input[aria-label*="username" i]',
    'input[name="username"]',
    'input[id="username"]',
    'input[name*="user"]',
    'input[id*="user"]',
    'input[type="text"]',
  ]

  // Check parent and siblings
  const parent = passwordField.parentElement
  if (!parent) return null

  // Try each selector on the parent
  for (const selector of usernameSelectors) {
    try {
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
    } catch (e) {
      // Some selectors might not be supported, ignore errors
    }
  }

  // Check nearby elements (go up one level and search)
  const grandparent = parent.parentElement
  if (!grandparent) return null

  // Try each selector on the grandparent
  for (const selector of usernameSelectors) {
    try {
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
    } catch (e) {
      // Some selectors might not be supported, ignore errors
    }
  }

  // Last resort: find any visible text input in the document that's near the password field
  const allInputs = document.querySelectorAll('input[type="text"], input[type="email"]')
  let closestInput = null
  let closestDistance = Number.POSITIVE_INFINITY

  const passwordRect = passwordField.getBoundingClientRect()

  for (const input of allInputs) {
    if (input !== passwordField && isVisibleElement(input)) {
      const inputRect = input.getBoundingClientRect()
      const distance = Math.sqrt(
        Math.pow(inputRect.left - passwordRect.left, 2) + Math.pow(inputRect.top - passwordRect.top, 2),
      )

      if (distance < closestDistance) {
        closestDistance = distance
        closestInput = input
      }
    }
  }

  // Only return if it's reasonably close (within 300px)
  if (closestDistance < 300) {
    return closestInput
  }

  return null
}

// Analyze if the page is likely a login or registration page
function analyzePageType() {
  log("Analyzing page type for:", window.location.href)

  // Reset page type
  state.isRegistrationPage = false
  state.isLoginPage = false

  // Special detection for Facebook
  if (isFacebookDomain()) {
    analyzeFacebookPageType()
    return
  }

  // Standard detection for other sites
  const url = window.location.href.toLowerCase()
  const urlIndicators = {
    registration: ["register", "signup", "sign-up", "join", "create-account", "registration", "r.php"],
    login: ["login", "log-in", "signin", "sign-in", "authenticate", "login.php"],
  }

  // Check URL for indicators
  for (const indicator of urlIndicators.registration) {
    if (url.includes(indicator)) {
      state.isRegistrationPage = true
      log("Registration page detected via URL:", indicator)
      break
    }
  }

  for (const indicator of urlIndicators.login) {
    if (url.includes(indicator)) {
      state.isLoginPage = true
      log("Login page detected via URL:", indicator)
      break
    }
  }

  // If URL analysis is inconclusive, check page content
  if (!state.isRegistrationPage && !state.isLoginPage) {
    // Check for registration indicators in the page
    const registrationTexts = ["register", "sign up", "create account", "join now", "vytvoriť účet"]
    const pageText = document.body.innerText.toLowerCase()

    for (const text of registrationTexts) {
      if (pageText.includes(text)) {
        state.isRegistrationPage = true
        log("Registration page detected via text:", text)
        break
      }
    }

    // Check for multiple password fields (common in registration forms)
    if (state.passwordFields.length >= 2) {
      state.isRegistrationPage = true
      log("Registration page detected via multiple password fields")
    }

    // Check for login indicators
    const loginTexts = ["log in", "sign in", "login", "prihlásiť", "prihlásenie"]
    for (const text of loginTexts) {
      if (pageText.includes(text)) {
        state.isLoginPage = true
        log("Login page detected via text:", text)
        break
      }
    }
  }

  log("Page type analysis result:", { isLoginPage: state.isLoginPage, isRegistrationPage: state.isRegistrationPage })
}

// Specialized analysis for Facebook pages
function analyzeFacebookPageType() {
  const url = window.location.href.toLowerCase()

  // Kontrola, či sme na prihlasovacej stránke Facebooku
  if (
    url === "https://www.facebook.com/" ||
    url === "https://www.facebook.com/?_rdr" ||
    url === "https://m.facebook.com/" ||
    url === "https://m.facebook.com/?_rdr" ||
    url.match(/^https?:\/\/(www|m)\.facebook\.com\/?(\?.*)?$/) ||
    url.includes("facebook.com/login") ||
    url.includes("login.php") ||
    url.includes("en-gb.facebook.com/login")
  ) {
    state.isLoginPage = true
    log("Facebook login page detected via URL")
    return
  }

  // Kontrola registračných stránok
  if (url.includes("facebook.com/r.php") || url.includes("facebook.com/reg/")) {
    state.isRegistrationPage = true
    log("Facebook registration page detected via URL")
    return
  }

  // Kontrola titulku stránky
  const pageTitle = document.title.toLowerCase()
  if (pageTitle.includes("sign up") || pageTitle.includes("create account") || pageTitle.includes("register")) {
    state.isRegistrationPage = true
    log("Facebook registration page detected via title")
    return
  }

  if (pageTitle.includes("log in") || pageTitle.includes("login") || pageTitle.includes("prihlásenie")) {
    state.isLoginPage = true
    log("Facebook login page detected via title")
    return
  }

  // Kontrola formulárových prvkov
  const registrationPasswordInput = document.querySelector(
    'input[name="reg_passwd__"], input[id="password_step_input"], input[data-type="password"][autocomplete="new-password"]',
  )

  if (registrationPasswordInput) {
    state.isRegistrationPage = true
    log("Facebook registration page detected via form elements")
    return
  }

  const loginPasswordInput = document.querySelector('input[name="pass"], input[id="pass"]')
  const loginButton = document.querySelector('button[name="login"], button[id="loginbutton"]')

  if (loginPasswordInput) {
    state.isLoginPage = true
    log("Facebook login page detected via form elements")
    return
  }

  // Kontrola textu na stránke
  const pageText = document.body.innerText.toLowerCase()
  if (pageText.includes("create a new account") || pageText.includes("sign up for facebook")) {
    state.isRegistrationPage = true
    log("Facebook registration page detected via page text")
    return
  }

  if (
    pageText.includes("log in to facebook") ||
    (pageText.includes("email or phone") && pageText.includes("password"))
  ) {
    state.isLoginPage = true
    log("Facebook login page detected via page text")
    return
  }

  log("Could not determine Facebook page type, defaulting to login page")
  state.isLoginPage = true // Predvolene považujeme stránku za prihlasovaciu
}

// Set up event listeners for the detected fields
function setupEventListeners() {
  log("Setting up event listeners")

  // Listen for password field focus to show suggestions
  state.passwordFields.forEach((field) => {
    field.removeEventListener("focus", handlePasswordFieldFocus) // Remove existing listener
    field.addEventListener("focus", handlePasswordFieldFocus)
    log("Added focus listener to password field")
  })

  // Listen for form submissions to capture credentials
  state.formFields.forEach((formData) => {
    if (formData.form) {
      formData.form.removeEventListener("submit", handleFormSubmitWrapper) // Remove existing listener
      formData.form.addEventListener("submit", handleFormSubmitWrapper)
      log("Added submit listener to form")
    }
  })

  // Add listeners to all submit buttons in the document
  const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]')
  submitButtons.forEach((button) => {
    button.removeEventListener("click", handleButtonClickWrapper)
    button.addEventListener("click", handleButtonClickWrapper)
    log("Added click listener to submit button")
  })

  // Special support for Facebook
  if (isFacebookDomain()) {
    setupFacebookEventListeners()
  }
}

// Wrapper for handleFormSubmit to allow removing the listener
function handleFormSubmitWrapper(e) {
  const formData = state.formFields.find((f) => f.form === e.currentTarget)
  if (formData) {
    handleFormSubmit(e, formData)
  }
}

// Set up Facebook-specific event listeners
function setupFacebookEventListeners() {
  log("Setting up Facebook-specific event listeners")

  // Login button
  const loginButtons = document.querySelectorAll(
    'button[name="login"], button[id="loginbutton"], button[type="submit"], button[data-testid="royal_login_button"]',
  )

  loginButtons.forEach((button) => {
    if (isVisibleElement(button)) {
      button.removeEventListener("click", handleFacebookLoginClick)
      button.addEventListener("click", handleFacebookLoginClick)
      log("Added click listener to Facebook login button")
    }
  })

  // Email input change event
  const emailInputs = document.querySelectorAll(
    'input[name="email"], input[id="email"], input[data-testid="royal_email"]',
  )

  emailInputs.forEach((input) => {
    input.removeEventListener("change", checkSavedPasswordsForEmail)
    input.addEventListener("change", checkSavedPasswordsForEmail)
    log("Added change listener to email input")
  })
}

// Handle Facebook login button click
function handleFacebookLoginClick(e) {
  log("Facebook login button clicked")

  if (state.formFields.length > 0) {
    // Find the form associated with this button
    const button = e.currentTarget
    const nearestForm = button.closest("form")

    // Try to find the form that contains this button
    const formData = state.formFields.find((f) => f.form === nearestForm) || state.formFields[0]

    handleFormSubmit(e, formData)
  }
}

// Check saved passwords when email changes
function checkSavedPasswordsForEmail(e) {
  const email = e.target.value
  if (email && email.length > 0) {
    log("Email changed, checking saved passwords for:", email)
    checkSavedPasswords()
  }
}

// Set up mutation observer to detect dynamic form changes
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
            // Kontrola, či pridaný uzol je alebo obsahuje formulárový prvok alebo pole pre heslo
            if (
              node.tagName === "FORM" ||
              node.querySelector("form") ||
              node.querySelector('input[type="password"]') ||
              node.querySelector('input[data-type="password"]') ||
              node.querySelector('input[name="email"]') ||
              node.querySelector('input[name="pass"]') ||
              node.querySelector("input.inputtext._55r1") ||
              node.querySelector("input.inputtext._1kbt") ||
              node.querySelector("input.inputtext._9npi")
            ) {
              shouldRedetect = true
              break
            }
          }
        }
      }
    })

    if (shouldRedetect) {
      log("DOM changed, re-detecting forms")
      setTimeout(initializeExtension, 500)
    }
  })

  // Spustíme observer
  window.passwordManagerObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })

  log("Mutation observer set up")

  // Pridáme aj interval pre pravidelné kontroly
  if (!window.formDetectionInterval) {
    window.formDetectionInterval = setInterval(() => {
      // Kontrola, či existuje heslo, ktoré sme ešte nezaregistrovali
      const passwordInputs = document.querySelectorAll('input[type="password"], input[data-type="password"]')
      let newPasswordFound = false

      passwordInputs.forEach((input) => {
        if (!state.passwordFields.includes(input)) {
          newPasswordFound = true
        }
      })

      // Špeciálna kontrola pre Facebook login.php stránku
      if (window.location.href.includes("login.php") && !state.credentialsOffered) {
        const emailInput = document.querySelector('input.inputtext._55r1.inputtext._1kbt.inputtext._1kbt[name="email"]')
        const passwordInput = document.querySelector(
          'input.inputtext._55r1.inputtext._9npi.inputtext._9npi[name="pass"]',
        )

        if (
          emailInput &&
          passwordInput &&
          !state.formFields.some((f) => f.usernameField === emailInput && f.passwordFields.includes(passwordInput))
        ) {
          log("Found Facebook login.php form in interval check")
          newPasswordFound = true
        }
      }

      if (newPasswordFound) {
        log("New password field found by interval check")
        initializeExtension()
      }

      // Špeciálna kontrola pre Facebook
      if (isFacebookDomain() && !state.credentialsOffered) {
        checkFacebookLoginForm()
      }
    }, 1000) // Kontrola každú sekundu
  }
}

// Handle password field focus
function handlePasswordFieldFocus(event) {
  const passwordField = event.target

  log("Password field focused", {
    isRegistrationPage: state.isRegistrationPage,
    url: window.location.href,
  })

  // Skip if password already filled or suggestion already shown
  if (passwordField.value || state.passwordSuggestionShown) {
    log("Password already filled or suggestion already shown, skipping")
    return
  }

  // Show password suggestion for registration pages
  if (
    state.isRegistrationPage ||
    (isFacebookDomain() && (window.location.href.includes("r.php") || window.location.href.includes("reg/")))
  ) {
    log("Showing password suggestion for registration")
    showPasswordSuggestion(passwordField)
  }
}

// Show password suggestion UI
function showPasswordSuggestion(passwordField) {
  log("Showing password suggestion for field")

  // Mark that suggestion has been shown
  state.passwordSuggestionShown = true

  // Remove existing suggestions
  const existingSuggestions = document.querySelectorAll(".password-suggestion")
  existingSuggestions.forEach((el) => el.remove())

  // Use a fixed password
  const securePassword = "test-heslo-123"

  // Create suggestion UI
  const suggestionElement = document.createElement("div")
  suggestionElement.className = "password-suggestion"

  // Special styling for Facebook
  if (isFacebookDomain()) {
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
  log("Password suggestion element added to page")

  // Add event listener to the "Use" button
  const useButton = suggestionElement.querySelector(".password-suggestion-btn")
  useButton.addEventListener("click", () => {
    log("Password suggestion accepted")

    // Fill the password field
    passwordField.value = securePassword

    // Trigger input event
    const inputEvent = new Event("input", { bubbles: true })
    passwordField.dispatchEvent(inputEvent)

    // Special logic for Facebook
    if (isFacebookDomain()) {
      // For Facebook registration
      const confirmPasswordField = document.querySelector('input[name="reg_passwd_confirmation"]')
      if (confirmPasswordField) {
        confirmPasswordField.value = securePassword
        confirmPasswordField.dispatchEvent(new Event("input", { bubbles: true }))
      }
    } else {
      // Standard logic for other sites
      // If there's a second password field (confirm password), fill that too
      const formData = state.formFields.find((f) => f.passwordFields.includes(passwordField))
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
  })

  // Remove the suggestion when clicking outside
  document.addEventListener("click", function removeSuggestion(e) {
    if (!suggestionElement.contains(e.target) && e.target !== passwordField) {
      // Check if element still exists in DOM
      if (suggestionElement.parentNode) {
        document.body.removeChild(suggestionElement)
      }
      document.removeEventListener("click", removeSuggestion)
    }
  })
}

// Handle form submission
function handleFormSubmit(event, formData) {
  log("Form submit detected")

  // Prevent default behavior for registration pages
  if (event && event.preventDefault && state.isRegistrationPage) {
    event.preventDefault()
  }

  // Get values from fields
  const usernameValue = formData.usernameField ? formData.usernameField.value : ""
  const passwordValue = formData.passwordFields[0].value

  log("Form values:", {
    username: usernameValue ? usernameValue.substring(0, 3) + "..." : "",
    password: passwordValue ? "********" : "",
  })

  if (usernameValue && passwordValue) {
    // Determine if this is a new registration or a login
    if (state.isRegistrationPage) {
      // Save the new credentials
      saveNewCredentials(usernameValue, passwordValue)
      log("Credentials saved for registration")

      // If we prevented default, submit the form after saving
      if (event && event.preventDefault && formData.form) {
        setTimeout(() => {
          formData.form.submit()
        }, 500)
      }
    } else if (state.isLoginPage) {
      // Update existing credentials if needed
      updateCredentialsIfNeeded(usernameValue, passwordValue)
    }
  }
}

// Handle button click
function handleButtonClickWrapper(e) {
  // Find the nearest form
  const form = e.currentTarget.closest("form")
  if (form) {
    const formData = state.formFields.find((f) => f.form === form)
    if (formData) {
      handleFormSubmit(e, formData)
    }
  }
}

// Save new credentials
function saveNewCredentials(username, password) {
  // Get page title or domain as the site name
  const siteName = document.title || state.currentDomain

  // Prepare data
  const data = {
    name: siteName,
    username: username,
    password: password,
    website: window.location.origin,
    category: determineCategoryFromDomain(state.currentDomain),
    favorite: false,
    folder: null,
    note: "",
    dateAdded: new Date().toISOString(),
  }

  // Send message to background script to save the password
  browser.runtime.sendMessage(
    {
      action: "savePassword",
      data: data,
    },
    (response) => {
      log("Password saved:", response ? (response.success ? "success" : "failed") : "no response")
    },
  )
}

// Update existing credentials if needed
function updateCredentialsIfNeeded(username, password) {
  // Check if we already have credentials for this domain
  browser.runtime.sendMessage(
    {
      action: "getPasswordsForDomain",
      domain: state.currentDomain,
    },
    (response) => {
      if (response && response.success && response.passwords && response.passwords.length > 0) {
        // Check if the username matches any existing entry
        const matchingEntry = response.passwords.find((p) => p.username === username)

        if (matchingEntry) {
          // If password is different, update it
          if (matchingEntry.password !== password) {
            // Update the password
            matchingEntry.password = password
            matchingEntry.dateModified = new Date().toISOString()

            browser.runtime.sendMessage(
              {
                action: "updatePassword",
                data: matchingEntry,
              },
              (updateResponse) => {
                log(
                  "Password updated:",
                  updateResponse ? (updateResponse.success ? "success" : "failed") : "no response",
                )
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

// Check if we have saved passwords for this domain
function checkSavedPasswords() {
  log("Checking saved passwords for domain:", state.currentDomain)

  // Preskočiť, ak sme už ponúkli prihlasovacie údaje
  if (state.credentialsOffered) {
    log("Credentials already offered, skipping check")
    return
  }

  // Vždy skontrolovať uložené heslá na Facebook doménach alebo prihlasovacích stránkach
  if (state.isLoginPage || isFacebookDomain()) {
    // Pre Facebook použijeme špeciálnu logiku - skúsime nájsť heslá pre všetky Facebook domény
    if (isFacebookDomain()) {
      log("Facebook domain detected, checking all Facebook domains")

      // Najprv skúsime aktuálnu doménu
      browser.runtime.sendMessage(
        {
          action: "getPasswordsForDomain",
          domain: state.currentDomain,
        },
        (response) => {
          if (response && response.success && response.passwords && response.passwords.length > 0) {
            log("Found saved passwords for current domain:", response.passwords.length)
            state.credentialsOffered = true
            handleFacebookSavedPasswords(response.passwords)
          } else {
            // Ak nenájdeme heslá pre aktuálnu doménu, skúsime všetky Facebook domény
            log("No passwords found for current domain, trying all Facebook domains")
            browser.runtime.sendMessage(
              {
                action: "getPasswordsForDomain",
                domain: "facebook.com",
              },
              (fbResponse) => {
                if (fbResponse && fbResponse.success && fbResponse.passwords && fbResponse.passwords.length > 0) {
                  log("Found saved passwords for facebook.com:", fbResponse.passwords.length)
                  state.credentialsOffered = true
                  handleFacebookSavedPasswords(fbResponse.passwords)
                } else {
                  log("No saved passwords found for any Facebook domain")
                }
              },
            )
          }
        },
      )
    } else {
      // Štandardná logika pre ostatné stránky
      browser.runtime.sendMessage(
        {
          action: "getPasswordsForDomain",
          domain: state.currentDomain,
        },
        (response) => {
          log("Got response from background script:", response ? "success" : "error")

          if (response && response.success && response.passwords && response.passwords.length > 0) {
            log("Found saved passwords:", response.passwords.length)
            state.credentialsOffered = true

            if (response.passwords.length === 1) {
              // Len jedno heslo, ponúkneme automatické vyplnenie
              offerAutofill(response.passwords[0])
            } else {
              // Viacero hesiel, ponúkneme výber
              offerPasswordSelection(response.passwords)
            }
          } else {
            log("No saved passwords found or error in response")
          }
        },
      )
    }
  } else if (state.isRegistrationPage) {
    // Pre registračnú stránku ponúkneme generovanie hesla
    const passwordField = state.passwordFields[0]
    if (passwordField && !passwordField.value && !state.passwordSuggestionShown) {
      log("Registration page detected, offering password generation")
      showPasswordSuggestion(passwordField)
    }
  }
}

// Handle saved passwords for Facebook
function handleFacebookSavedPasswords(passwords) {
  log("Handling Facebook saved passwords")

  // Nájdeme formulárové prvky - špeciálna podpora pre login.php
  let emailInput = null
  let passwordInput = null

  if (window.location.href.includes("login.php")) {
    // Špecifické selektory pre login.php
    emailInput = document.querySelector('input.inputtext._55r1.inputtext._1kbt.inputtext._1kbt[name="email"]')
    passwordInput = document.querySelector('input.inputtext._55r1.inputtext._9npi.inputtext._9npi[name="pass"]')
  }

  // Ak nenájdeme špecifické polia, skúsime štandardné selektory
  if (!emailInput) {
    emailInput = document.querySelector(
      'input[name="email"], input[id="email"], input[data-testid="royal_email"], input[placeholder="Email or phone number"], input[placeholder="E-mail alebo telefónne číslo"]',
    )
  }

  if (!passwordInput) {
    passwordInput = document.querySelector(
      'input[name="pass"], input[id="pass"], input[data-testid="royal_pass"], input[placeholder="Password"], input[placeholder="Heslo"]',
    )
  }

  if (!emailInput || !passwordInput) {
    log("Could not find Facebook login form elements")
    return
  }

  // Ak je email už vyplnený, skúsime nájsť zodpovedajúce heslo
  if (emailInput.value && emailInput.value.length > 0) {
    const matchingPassword = passwords.find((p) => p.username === emailInput.value)
    if (matchingPassword) {
      log("Found matching password for email")
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

// Offer to autofill a single saved password
function offerAutofill(passwordData) {
  // Nájdeme formulár na vyplnenie
  const formData = state.formFields[0] // Použijeme prvý formulár s poľom pre heslo

  if (formData) {
    // Vytvoríme UI pre návrh automatického vyplnenia
    const suggestionElement = document.createElement("div")
    suggestionElement.className = "password-suggestion"

    // Špeciálny štýl pre Facebook
    if (isFacebookDomain()) {
      suggestionElement.style.zIndex = "9999999"
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
        <p>Chceš sa prihlásiť ako ${passwordData.username}?</p>
        <p>Tvoje heslo máme v bezpečí :)</p>
      </div>
      <div class="password-suggestion-actions">
        <button class="password-suggestion-btn">Použiť</button>
      </div>
    `

    // Umiestnime návrh blízko poľa pre používateľské meno
    const fieldRect = formData.usernameField
      ? formData.usernameField.getBoundingClientRect()
      : formData.passwordFields[0].getBoundingClientRect()

    suggestionElement.style.position = "absolute"
    suggestionElement.style.left = `${fieldRect.left}px`
    suggestionElement.style.top = `${fieldRect.bottom + window.scrollY + 5}px`

    // Pridáme na stránku
    document.body.appendChild(suggestionElement)

    // Pridáme event listener na tlačidlo "Použiť"
    const useButton = suggestionElement.querySelector(".password-suggestion-btn")
    useButton.addEventListener("click", () => {
      // Vyplníme formulár
      if (formData.usernameField) {
        formData.usernameField.value = passwordData.username
        formData.usernameField.dispatchEvent(new Event("input", { bubbles: true }))
      }

      formData.passwordFields.forEach((field) => {
        field.value = passwordData.password
        field.dispatchEvent(new Event("input", { bubbles: true }))
      })

      // Odstránime UI návrhu
      document.body.removeChild(suggestionElement)

      // Pre login.php stránku môžeme skúsiť aj automatické odoslanie formulára
      if (window.location.href.includes("login.php")) {
        const loginButton = document.querySelector(
          'button[id="loginbutton"], button[name="login"], button[type="submit"]',
        )
        if (loginButton) {
          setTimeout(() => {
            loginButton.click()
          }, 500)
        }
      }
    })

    // Odstránime návrh pri kliknutí mimo
    document.addEventListener("click", function removeSuggestion(e) {
      if (
        !suggestionElement.contains(e.target) &&
        e.target !== formData.usernameField &&
        !formData.passwordFields.includes(e.target)
      ) {
        // Skontrolujeme, či element ešte existuje v DOM
        if (suggestionElement.parentNode) {
          document.body.removeChild(suggestionElement)
        }
        document.removeEventListener("click", removeSuggestion)
      }
    })
  }
}

// Offer to select from multiple saved passwords
function offerPasswordSelection(passwords) {
  // Find the form to fill
  const formData = state.formFields[0] // Use the first form with password field

  if (formData) {
    // Create password selection UI
    const selectionElement = document.createElement("div")
    selectionElement.className = "password-selection"

    // Special styling for Facebook
    if (isFacebookDomain()) {
      selectionElement.style.zIndex = "9999"
      selectionElement.style.backgroundColor = "#fff"
      selectionElement.style.border = "1px solid #dddfe2"
      selectionElement.style.borderRadius = "8px"
      selectionElement.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)"
      selectionElement.style.padding = "16px"
      selectionElement.style.maxWidth = "400px"
      selectionElement.style.fontFamily = "Helvetica, Arial, sans-serif"
    }

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
          formData.usernameField.dispatchEvent(new Event("input", { bubbles: true }))
        }

        formData.passwordFields.forEach((field) => {
          field.value = password
          formData.passwordFields.dispatchEvent(new Event("input", { bubbles: true }))
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

// Upraviť funkciu isFacebookDomain() aby lepšie rozpoznala všetky Facebook domény
function isFacebookDomain() {
  return state.currentDomain.includes("facebook.com") || state.currentDomain.includes("fb.com")
}
