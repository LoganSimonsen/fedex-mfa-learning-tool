import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const initialForm = {
  fedexAccountNumber: "",
  carrierAccountId: "",
  type: "FedexAccount",
  name: "",
  street1: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "US",
  invoiceNumber: "",
  invoiceDate: "",
  invoiceAmount: "",
  invoiceCurrency: "USD",
};

function prettyJson(obj) {
  return JSON.stringify(obj, null, 2);
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return "Not provided";
  }

  if (apiKey.length <= 8) {
    return "*".repeat(apiKey.length);
  }

  return `${apiKey.slice(0, 4)}${"*".repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
}

function StepCard({ number, title, active, complete, children }) {
  let className = "step-card";
  if (active) className += " step-card-active";
  if (complete) className += " step-card-complete";

  return (
    <div className={className}>
      <div className="step-header">
        <div className="step-number">{complete ? "✓" : number}</div>
        <div>
          <div className="step-label">Step {number}</div>
          <div className="step-title">{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function App() {
  const [mode, setMode] = useState("update");
  const [flow, setFlow] = useState("pin");
  const [step, setStep] = useState(1);
  const [pinOption, setPinOption] = useState("SMS");
  const [pinCode, setPinCode] = useState("");
  const [addressValidated, setAddressValidated] = useState(false);
  const [pinSent, setPinSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [log, setLog] = useState([]);
  const [apiResponse, setApiResponse] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [apiRequest, setApiRequest] = useState(null);
  const [apiOperation, setApiOperation] = useState("address-validation");
  const [easypostApiKey, setEasypostApiKey] = useState("");
  const [backendHealth, setBackendHealth] = useState({
    status: "checking",
    httpStatus: null,
    error: null,
  });

  const [form, setForm] = useState(initialForm);

  const easypostDetails = useMemo(() => {
    return {
      action: mode,
      type: form.type,
      carrier_account_id: mode === "update" ? form.carrierAccountId : null,
    };
  }, [mode, form.type, form.carrierAccountId]);

  function addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    setLog((prev) => [`${timestamp}: ${message}`, ...prev]);
  }

  function resetFlow() {
    setStep(1);
    setAddressValidated(false);
    setPinSent(false);
    setComplete(false);
    setPinCode("");
    setForm(initialForm);
    setLog([]);
    setApiResponse(null);
    setApiError(null);
    setApiStatus(null);
    setApiRequest(null);
    setApiOperation("address-validation");
    checkBackendHealth();
  }

  function handleFieldChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  const addressPayload = {
    address_validation: {
      name: form.name,
      street1: form.street1,
      city: form.city,
      state: form.state,
      postal_code: form.postalCode,
      country_code: form.countryCode,
    },
    easypost_details: easypostDetails,
  };

  const pinPayload = {
    pin_method: {
      option: pinOption,
    },
    easypost_details: easypostDetails,
  };

  const pinValidationPayload = {
    pin_validation: {
      pin_code: pinCode || "{RECEIVED_PIN}",
      name: form.name,
    },
    easypost_details: easypostDetails,
  };

  const invoicePayload = {
    invoice_validation: {
      name: form.name,
      invoice_number: form.invoiceNumber,
      invoice_date: form.invoiceDate,
      invoice_amount: form.invoiceAmount,
      invoice_currency: form.invoiceCurrency,
    },
    easypost_details: easypostDetails,
  };

  const availablePinOptions =
    apiResponse?.options && Array.isArray(apiResponse.options)
      ? apiResponse.options
      : ["SMS", "CALL", "EMAIL"];

  const completedResult = apiResponse?.carrier_account || apiResponse;

  async function runApiRequest({ operation, endpoint, requestBody }) {
    if (!easypostApiKey.trim()) {
      throw new Error("Enter an EasyPost API key before making a request.");
    }

    setApiOperation(operation);
    setApiRequest(requestBody);
    setApiError(null);
    setApiStatus(null);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-easypost-api-key": easypostApiKey.trim(),
      },
      body: JSON.stringify(requestBody),
    });

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    let data = null;
    if (rawText) {
      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { raw: rawText };
        }
      } else {
        data = { raw: rawText };
      }
    }

    setApiStatus(response.status);
    setApiResponse(data);

    if (!response.ok) {
      throw new Error(
        data?.error || `${operation} failed with status ${response.status}`,
      );
    }

    if (!contentType.includes("application/json")) {
      throw new Error(
        `Expected JSON from ${endpoint}, but received HTML. Confirm the Express server is running on http://localhost:3001 and restart the React dev server.`,
      );
    }

    return data;
  }

  async function checkBackendHealth() {
    setBackendHealth({
      status: "checking",
      httpStatus: null,
      error: null,
    });

    try {
      const response = await fetch("/api/health", {
        headers: {
          Accept: "application/json",
        },
      });

      const contentType = response.headers.get("content-type") || "";
      const rawText = await response.text();

      if (!contentType.includes("application/json")) {
        throw new Error(
          "Expected JSON from /api/health. Confirm the Express server is running on http://localhost:3001 and restart the React dev server.",
        );
      }

      const data = rawText ? JSON.parse(rawText) : null;

      if (!response.ok || !data?.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      setBackendHealth({
        status: "healthy",
        httpStatus: response.status,
        error: null,
      });
    } catch (err) {
      setBackendHealth({
        status: "unhealthy",
        httpStatus: null,
        error: err.message,
      });
    }
  }

  useEffect(() => {
    checkBackendHealth();
  }, []);

  async function runAddressValidation() {
    return runApiRequest({
      operation: "address-validation",
      endpoint: "/api/fedex/address-validation",
      requestBody: {
        accountNumber: form.fedexAccountNumber,
        payload: addressPayload,
      },
    });
  }

  async function handleAddressValidation() {
    try {
      const data = await runAddressValidation();

      if (Array.isArray(data.options) && data.options.length > 0) {
        setPinOption(data.options[0]);
      }

      setAddressValidated(true);
      setStep(2);
      addLog("Address validation completed.");
    } catch (err) {
      console.error(err);
      setApiError(err.message);
      addLog(`Address validation failed: ${err.message}`);
    }
  }

  async function handleGeneratePin() {
    try {
      await runApiRequest({
        operation: "pin-generate",
        endpoint: "/api/fedex/pin-generate",
        requestBody: {
          accountNumber: form.fedexAccountNumber,
          payload: pinPayload,
        },
      });

      setPinSent(true);
      setStep(3);
      addLog(`PIN requested via ${pinOption}.`);
    } catch (err) {
      console.error(err);
      setApiError(err.message);
      addLog(`PIN generation failed: ${err.message}`);
    }
  }

  async function handleValidatePin() {
    try {
      const data = await runApiRequest({
        operation: "pin-validate",
        endpoint: "/api/fedex/pin-validate",
        requestBody: {
          accountNumber: form.fedexAccountNumber,
          payload: pinValidationPayload,
        },
      });

      if (data?.carrier_account) {
        addLog("Carrier account returned from PIN validation.");
      }

      setComplete(true);
      setStep(4);
      addLog("PIN validated. FedEx account is now REST-enabled.");
    } catch (err) {
      console.error(err);
      setApiError(err.message);
      addLog(`PIN validation failed: ${err.message}`);
    }
  }

  async function handleValidateInvoice() {
    try {
      await runApiRequest({
        operation: "invoice-validate",
        endpoint: "/api/fedex/invoice-validate",
        requestBody: {
          accountNumber: form.fedexAccountNumber,
          payload: invoicePayload,
        },
      });

      setComplete(true);
      setStep(3);
      addLog("Invoice validation completed. FedEx account is now REST-enabled.");
    } catch (err) {
      console.error(err);
      setApiError(err.message);
      addLog(`Invoice validation failed: ${err.message}`);
    }
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="hero-card">
          <div className="hero-top">
            <div>
              <div className="badge-row">
                <span className="badge">EasyPost</span>
                <span className="badge">FedEx MFA</span>
                <span className="badge">Demo App</span>
              </div>
              <h1>FedEx Multi-Factor Authentication Demo</h1>
              <p className="hero-text">
                A partner-facing demonstration app showing how EasyPost partners
                can authenticate a FedEx BYOCA carrier account using address
                validation, PIN validation, invoice validation, or FedEx
                pre-validation.
              </p>
            </div>

            <div className="button-row">
              <button
                className={mode === "update" ? "btn btn-primary" : "btn"}
                onClick={() => {
                  setMode("update");
                  resetFlow();
                }}
              >
                Update existing account
              </button>
              <button
                className={mode === "create" ? "btn btn-primary" : "btn"}
                onClick={() => {
                  setMode("create");
                  resetFlow();
                }}
              >
                Create new account
              </button>
              <button className="btn" onClick={resetFlow}>
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="main-grid">
          <div className="left-column">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Flow selector</h2>
                  <p>All flows start with address validation.</p>
                </div>
                <div className="button-row">
                  <button
                    className={flow === "pin" ? "btn btn-primary" : "btn"}
                    onClick={() => {
                      setFlow("pin");
                      resetFlow();
                    }}
                  >
                    PIN flow
                  </button>
                  <button
                    className={flow === "invoice" ? "btn btn-primary" : "btn"}
                    onClick={() => {
                      setFlow("invoice");
                      resetFlow();
                    }}
                  >
                    Invoice flow
                  </button>
                  <button
                    className={
                      flow === "prevalidation" ? "btn btn-primary" : "btn"
                    }
                    onClick={() => {
                      setFlow("prevalidation");
                      resetFlow();
                    }}
                  >
                    Pre-validation
                  </button>
                </div>
              </div>
            </div>

            <StepCard
              number={1}
              title="Address validation"
              active={step === 1}
              complete={addressValidated}
            >
              <div className="form-grid">
                <label>
                  <span>EasyPost API key</span>
                  <input
                    type="password"
                    value={easypostApiKey}
                    onChange={(e) => setEasypostApiKey(e.target.value)}
                    placeholder="Enter your EasyPost API key"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </label>

                <label>
                  <span>Masked key preview</span>
                  <input value={maskApiKey(easypostApiKey)} readOnly />
                </label>
              </div>

              <div className="subtle-note">
                This key stays in browser memory only and is sent to the proxy
                per request. It is not stored in local storage or the backend.
              </div>

              <div className="warning-box">
                Use an EasyPost production API key only. Successful
                authentication will create or update a real FedEx carrier
                account on your EasyPost profile.
              </div>

              <div className="form-grid">
                <label>
                  <span>FedEx 9-digit account number</span>
                  <input
                    value={form.fedexAccountNumber}
                    onChange={(e) =>
                      handleFieldChange("fedexAccountNumber", e.target.value)
                    }
                    placeholder="Enter your FedEx 9-digit account number"
                  />
                </label>

                <label>
                  <span>
                    EasyPost carrier account ID{" "}
                    {mode === "create" ? "(optional / null)" : ""}
                  </span>
                  <input
                    value={form.carrierAccountId}
                    onChange={(e) =>
                      handleFieldChange("carrierAccountId", e.target.value)
                    }
                    placeholder={
                      mode === "create"
                        ? "Leave blank for create flow"
                        : "Enter your existing EasyPost carrier account ID"
                    }
                    disabled={mode === "create"}
                  />
                </label>

                <label>
                  <span>Account name</span>
                  <input
                    value={form.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="Enter the FedEx account name"
                  />
                </label>

                <label>
                  <span>Street 1</span>
                  <input
                    value={form.street1}
                    onChange={(e) =>
                      handleFieldChange("street1", e.target.value)
                    }
                    placeholder="Enter the billing street address"
                  />
                </label>

                <label>
                  <span>City</span>
                  <input
                    value={form.city}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    placeholder="Enter the billing city"
                  />
                </label>

                <label>
                  <span>State</span>
                  <input
                    value={form.state}
                    onChange={(e) => handleFieldChange("state", e.target.value)}
                    placeholder="State or province"
                  />
                </label>

                <label>
                  <span>Postal code</span>
                  <input
                    value={form.postalCode}
                    onChange={(e) =>
                      handleFieldChange("postalCode", e.target.value)
                    }
                    placeholder="Postal or ZIP code"
                  />
                </label>

                <label>
                  <span>Country code</span>
                  <input
                    value={form.countryCode}
                    onChange={(e) =>
                      handleFieldChange("countryCode", e.target.value)
                    }
                    placeholder="Country code, for example US"
                  />
                </label>
              </div>

              <div className="action-row">
                <button
                  className="btn btn-primary"
                  disabled={!easypostApiKey.trim()}
                  onClick={handleAddressValidation}
                >
                  Run address validation
                </button>
                <div className="endpoint-note">
                  Endpoint: /v2/fedex_registrations/:account_number/address
                </div>
              </div>
            </StepCard>

            {flow === "pin" && (
              <StepCard
                number={2}
                title="Generate verification PIN"
                active={step === 2 && addressValidated && !pinSent}
                complete={pinSent}
              >
                <div className="option-grid">
                  {availablePinOptions.map((option) => (
                    <button
                      key={option}
                      className={
                        pinOption === option
                          ? "option-card option-card-active"
                          : "option-card"
                      }
                      onClick={() => setPinOption(option)}
                    >
                      <strong>{option}</strong>
                      <span>Choose delivery method</span>
                    </button>
                  ))}
                </div>

                  <button
                    className="btn btn-primary"
                    disabled={!addressValidated || !easypostApiKey.trim()}
                    onClick={handleGeneratePin}
                  >
                    Generate PIN
                </button>

                <div className="warning-box">
                  The email or phone used for authentication must be associated
                  with the FedEx account profile.
                </div>
              </StepCard>
            )}

            {flow === "pin" && (
              <StepCard
                number={3}
                title="Validate PIN and complete MFA"
                active={step === 3 && pinSent && !complete}
                complete={complete}
              >
                <div className="inline-form">
                  <label className="inline-grow">
                    <span>Received PIN</span>
                    <input
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="123456"
                    />
                  </label>

                  <button
                    className="btn btn-primary"
                    disabled={
                      !pinSent || !pinCode || !easypostApiKey.trim()
                    }
                    onClick={handleValidatePin}
                  >
                    Validate PIN
                  </button>
                </div>
              </StepCard>
            )}

            {flow === "invoice" && (
              <StepCard
                number={2}
                title="Submit invoice details"
                active={step === 2 && addressValidated && !complete}
                complete={complete}
              >
                <div className="form-grid">
                  <label>
                    <span>Invoice number</span>
                    <input
                      value={form.invoiceNumber}
                      onChange={(e) =>
                        handleFieldChange("invoiceNumber", e.target.value)
                      }
                      placeholder="Enter a recent FedEx invoice number"
                    />
                  </label>

                  <label>
                    <span>Invoice date</span>
                    <input
                      type="date"
                      value={form.invoiceDate}
                      onChange={(e) =>
                        handleFieldChange("invoiceDate", e.target.value)
                      }
                    />
                  </label>

                  <label>
                    <span>Invoice amount</span>
                    <input
                      value={form.invoiceAmount}
                      onChange={(e) =>
                        handleFieldChange("invoiceAmount", e.target.value)
                      }
                      placeholder="Invoice amount, for example 123.45"
                    />
                  </label>

                  <label>
                    <span>Currency</span>
                    <input
                      value={form.invoiceCurrency}
                      onChange={(e) =>
                        handleFieldChange("invoiceCurrency", e.target.value)
                      }
                      placeholder="Currency code, for example USD"
                    />
                  </label>
                </div>

                <div className="action-row">
                  <button
                    className="btn btn-primary"
                    disabled={!addressValidated || !easypostApiKey.trim()}
                    onClick={handleValidateInvoice}
                  >
                    Validate invoice
                  </button>
                  <div className="subtle-note">
                    Invoice must be issued within the last 90 days.
                  </div>
                </div>
              </StepCard>
            )}

            {flow === "prevalidation" && (
              <StepCard
                number={2}
                title="FedEx support pre-validation"
                active={step === 2 && addressValidated && !complete}
                complete={complete}
              >
                <div className="info-box">
                  <p>
                    Call FedEx at <strong>877-339-2774</strong>, say{" "}
                    <strong>“FedEx API”</strong>, and request completion of the
                    REST MFA pre-validation step.
                  </p>
                  <p>
                    After phone pre-validation is complete, EasyPost address
                    validation must be completed within <strong>7 days</strong>.
                  </p>
                </div>

                <button
                  className="btn btn-primary"
                  disabled={!addressValidated}
                  onClick={() => {
                    setComplete(true);
                    setStep(3);
                    addLog(
                      "FedEx pre-validation flow completed after address validation.",
                    );
                  }}
                >
                  Mark pre-validation complete
                </button>
              </StepCard>
            )}
          </div>

          <div className="right-column">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Backend health</h2>
                  <p>Checks the React proxy path to the Express server.</p>
                </div>
                <div className="button-row">
                  <button className="btn" onClick={checkBackendHealth}>
                    Recheck backend
                  </button>
                </div>
              </div>

              <div className="json-card">
                <div className="json-title">Status</div>
                <pre>
                  {backendHealth.status === "healthy"
                    ? `Connected (HTTP ${backendHealth.httpStatus})`
                    : backendHealth.status === "checking"
                      ? "Checking backend..."
                      : "Backend unavailable"}
                </pre>
              </div>

              {backendHealth.error && (
                <div className="json-card">
                  <div className="json-title">Health check error</div>
                  <pre>{backendHealth.error}</pre>
                </div>
              )}
            </div>

            <div className="panel">
              <h2>Demo response panel</h2>

              {apiError && (
                <div className="json-card">
                  <div className="json-title">API error</div>
                  <pre>{apiError}</pre>
                </div>
              )}

              {!addressValidated && (
                <div className="json-card">
                  <div className="json-title">
                    Waiting for address validation
                  </div>
                  <pre>{prettyJson(addressPayload)}</pre>
                </div>
              )}

              {addressValidated && !complete && flow !== "prevalidation" && (
                <>
                  <div className="json-card">
                    <div className="json-title">Latest API response</div>
                    <pre>{prettyJson(apiResponse)}</pre>
                  </div>

                  {flow === "pin" && (
                    <>
                      <div className="json-card">
                        <div className="json-title">PIN generation payload</div>
                        <pre>{prettyJson(pinPayload)}</pre>
                      </div>

                      <div className="json-card">
                        <div className="json-title">PIN validation payload</div>
                        <pre>{prettyJson(pinValidationPayload)}</pre>
                      </div>
                    </>
                  )}

                  {flow === "invoice" && (
                    <div className="json-card">
                      <div className="json-title">
                        Invoice validation payload
                      </div>
                      <pre>{prettyJson(invoicePayload)}</pre>
                    </div>
                  )}
                </>
              )}

              {complete && (
                <div className="success-card">
                  <div className="json-title">MFA complete</div>
                  <pre>{prettyJson(completedResult)}</pre>
                </div>
              )}
            </div>

            <div className="panel">
              <h2>Raw EasyPost API</h2>
              <div className="json-card">
                <div className="json-title">HTTP status</div>
                <pre>{apiStatus === null ? "Waiting for request" : apiStatus}</pre>
              </div>
              <div className="json-card">
                <div className="json-title">Operation</div>
                <pre>{apiOperation}</pre>
              </div>
              <div className="json-card">
                <div className="json-title">API key</div>
                <pre>{maskApiKey(easypostApiKey)}</pre>
              </div>
              <div className="json-card">
                <div className="json-title">Request JSON</div>
                <pre>{prettyJson(apiRequest)}</pre>
              </div>
              <div className="json-card">
                <div className="json-title">Response JSON</div>
                <pre>{prettyJson(apiResponse)}</pre>
              </div>
            </div>

            <div className="panel">
              <h2>Before you begin</h2>
              <div className="note-list">
                <div className="note-item">
                  Use your own EasyPost production API key. Test keys will not
                  work for FedEx MFA.
                </div>
                <div className="note-item">
                  Your API key is only used for the current session and is not
                  stored in local storage or on the backend.
                </div>
                <div className="note-item">
                  A successful flow creates or updates a real FedEx carrier
                  account on your EasyPost profile.
                </div>
                <div className="note-item">
                  Address validation is always the first required step before
                  PIN, invoice, or FedEx pre-validation can continue.
                </div>
              </div>
            </div>

            <div className="panel">
              <h2>Activity log</h2>
              {log.length === 0 ? (
                <div className="empty-log">No actions yet.</div>
              ) : (
                <div className="log-list">
                  {log.map((entry, index) => (
                    <div key={index} className="log-item">
                      {entry}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
