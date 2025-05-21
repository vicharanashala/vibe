Middleware

## 1. Problem Statement : A Day at “CityCare General Hospital”**

CityCare General Hospital prides itself on excellent patient care.  
But as the hospital grew, so did the complexity of discharging patients:

-   **Discharge Delays:**  Patients ready to leave waited hours because a single missing doctor’s signature held up the process.
    
-   **Bottlenecks:**  The pharmacy was often overwhelmed, holding up all discharges until medications were double-checked.
    
-   **No Feedback Loops:**  Nurses and patients never knew where their paperwork was stuck, so they couldn’t help resolve issues or update families.
    
-   **Silent Failures:**  Sometimes, a patient was sent home without a follow-up appointment or with incomplete instructions, because no one checked the final packet.
    
<img src="https://i.postimg.cc/5N1GHRKp/PS-middleware.png" width="300px" />


**The challenge:**  
How do you redesign the discharge process so that:

-   Every patient’s paperwork passes through the right checkpoints (doctor sign-off, pharmacy review, follow-up scheduling).
    
-   Delays and bottlenecks are visible and can be addressed quickly.
    
-   Patients and staff always know what’s happening and get a clear, consistent update at every step.
   


## 2. Learning Objectives

By the end of this lesson, you’ll be able to:

-   Understand what middleware is and why it’s essential for robust, accountable workflows.
    
-   Use built-in, third-party, and custom middleware in Express.
    
-   Chain multiple middleware for complex, multi-step processes.
    
-   Implement error-handling middleware for consistent, user-friendly error responses.
    
-   Design feedback loops and checkpoints to surface and resolve bottlenecks.
    

## 3. Concept Introduction with Analogy

## **Analogy: The Hospital Discharge Relay Race**

Imagine the discharge process as a relay race:

-   **Baton (Paperwork):**  Moves from doctor to pharmacy to scheduling to the exit desk.
    
-   **Checkpoints:**  Each runner (department) must pass the baton only after completing their part.
    
-   **Baton Handoff:**  If a runner drops the baton or is slow, the team (patient and staff) can see exactly where the process is stuck and step in to help.
    
-   **Finish Line:**  Only when every checkpoint is passed does the patient leave, with everything in order.
    

Middleware in software acts like these checkpoints and handoffs, ensuring every request (patient discharge) is processed in the right order, with full accountability and visibility.

**A. What Is Middleware?**

-   Middleware is a function that sits between the incoming request and the final handler.
    
-   Each middleware can:
    
    -   Check, modify, or reject the request.
        
    -   Pass control to the next step.
        
    -   Log progress or errors.
        
-   Middleware is essential for:
    
    -   Logging delays and bottlenecks.
        
    -   Enforcing required steps (doctor sign-off, pharmacy check, etc.).
        
    -   Providing feedback at every stage.
        

**Types of Middleware in Express**

| Type          | Example Use Case                       |
|---------------|----------------------------------------|
| Built-in      | express.json() for parsing JSON       |
| Third-party   | cors() for cross-origin requests      |
| Custom        | Your own logic: logging, checks, etc. |
| Error-handling| Centralized error responses           |


 **B. How Middleware Works: The Discharge Relay**

-   Middleware functions are called in order, one after another.
    
-   Each can call  `next()`  to pass control, or send a response to stop the chain.
    
-   If an error is passed to  `next(err)`, Express skips to error-handling middleware.
    
![Tool Box Challenge](https://i.postimg.cc/tgrv8R9M/Middleware.png)
 **C. Built-in Middleware Example**

  ```typescript
import express from "express";
const app = express();

// Built-in: Parse JSON bodies
app.use(express.json());

  ```

 **D. Third-party Middleware Example**
  ```typescript
import cors from "cors";

// Enable CORS for cross-origin requests
app.use(cors());
  ```
  
 **E. Custom Middleware: Logging and Bottleneck Tracking**
  ```typescript
function logDischargeStep(req, res, next) {
  req.dischargeLog = req.dischargeLog || [];
  req.dischargeLog.push({
    step: req.currentStep || "start",
    time: new Date().toISOString(),
  });
  next();
}
app.use(logDischargeStep);
  ```

Every step in the discharge process is timestamped, so delays are visible and traceable._

**F. Custom Middleware: Doctor Sign-off Check**
  ```typescript
function doctorSignoffCheck(req, res, next) {
  if (!req.body.doctorSigned) {
    return res.status(400).json({ error: "Doctor sign-off required before discharge." });
  }
  req.currentStep = "doctorSignoff";
  next();
}
  ```
Ensures no patient leaves without a doctor’s approval._

## **G. Custom Middleware: Pharmacy Review**
  ```typescript
function pharmacyReview(req, res, next) {
  if (!req.body.pharmacyChecked) {
    return res.status(400).json({ error: "Pharmacy review required before discharge." });
  }
  req.currentStep = "pharmacyReview";
  next();
}
  ```

No patient leaves without medication instructions being double-checked._

**H. Custom Middleware: Follow-up Scheduling**
  ```typescript
function followupCheck(req, res, next) {
  if (!req.body.followupScheduled) {
    return res.status(400).json({ error: "Follow-up appointment must be scheduled." });
  }
  req.currentStep = "followupCheck";
  next();
}
  ```
Ensures every patient has a plan for after they leave._

 **I. Error-Handling Middleware**
  ```typescript
function errorHandler(err, req, res, next) {
  // Log the full discharge log for troubleshooting
  console.error("Discharge log:", req.dischargeLog);
  res.status(500).json({ error: err.message || "Internal server error" });
}
app.use(errorHandler);
  ```

If anything goes wrong, staff can see exactly where the process failed._

**J. Middleware Order Matters!**

-   The order you register middleware is the order it runs.
    
-   Always put error-handling middleware  **last**.
    

## 5. Step-by-Step Data Modeling & Code Walkthrough

Let’s see how “CityCare General Hospital” uses middleware to improve its discharge workflow:

**A. Logging Every Discharge Request**

  ```typescript

function logDischargeRequest(req, res, next) {
  req.dischargeLog = req.dischargeLog || [];
  req.dischargeLog.push({ step: "requestReceived", time: new Date().toISOString() });
  next();
}
app.use(logDischargeRequest);

  ```
Every discharge request is timestamped and tracked, so delays or bottlenecks are visible._

**B. Checking Doctor Sign-Off**
  ```typescript


function doctorSignoffCheck(req, res, next) {
  if (!req.body.doctorSigned) {
    return res.status(400).json({ error: "Doctor sign-off required before discharge." });
  }
  req.dischargeLog.push({ step: "doctorSignoff", time: new Date().toISOString() });
  next();
}
  ```

No patient is discharged without a doctor’s approval._

 **C. Checking Pharmacy Review**
   ```typescript
function pharmacyReview(req, res, next) {
  if (!req.body.pharmacyChecked) {
    return res.status(400).json({ error: "Pharmacy review required before discharge." });
  }
  req.dischargeLog.push({ step: "pharmacyReview", time: new Date().toISOString() });
  next();
}
  ```

Ensures all medications are reviewed and ready._

 **D. Checking Follow-Up Scheduling**
   ```typescript
function followupCheck(req, res, next) {
  if (!req.body.followupScheduled) {
    return res.status(400).json({ error: "Follow-up appointment must be scheduled." });
  }
  req.dischargeLog.push({ step: "followupCheck", time: new Date().toISOString() });
  next();
}
  ```

Every patient leaves with a plan for next steps._

**E. Centralized Error Handling**
  ```typescript
function errorHandler(err, req, res, next) {
  console.error("Discharge log:", req.dischargeLog);
  res.status(500).json({ error: err.message || "Internal server error" });
}
app.use(errorHandler);
  ```
If anything fails, staff can review the full log to find and fix bottlenecks._

 **F. Full Example: Putting It All Together**
  ```typescript
import express from "express";
const app = express();

app.use(express.json());

app.use(logDischargeRequest);

app.post(
  "/discharge",
  doctorSignoffCheck,
  pharmacyReview,
  followupCheck,
  (req, res) => {
    req.dischargeLog.push({ step: "dischargeComplete", time: new Date().toISOString() });
    res.json({
      status: "Discharge complete",
      patient: req.body.patientName,
      log: req.dischargeLog,
    });
  }
);

app.use(errorHandler);

app.listen(3000, () => console.log("Hospital system running on port 3000"));
  ```

## 6. Interactive Challenge / Mini-Project

**Your Turn!**

-   Add a middleware that checks if the patient’s insurance approval is present (`req.body.insuranceApproved`).
    
-   If not, return a  `403 Forbidden`  with a clear error message.
    
-   Test by sending a discharge request without insurance approval.
    

## 7. Common Pitfalls & Best Practices

| Type          | Example Use Case                       |
|---------------|----------------------------------------|
| Built-in      | express.json() for parsing JSON       |
| Third-party   | cors() for cross-origin requests      |
| Custom        | Your own logic: logging, checks, etc. |
| Error-handling| Centralized error responses           |


## 8. Quick Recap & Key Takeaways

-   Middleware adds checkpoints and accountability to every workflow step.
    
-   Chain middleware to enforce process order and catch bottlenecks.
    
-   Centralized error handling and logging make it easy to spot and fix issues.
    
-   Feedback loops (discharge logs) help staff and patients know exactly where things stand.
    

## 9. Optional: Programmer’s Workflow Checklist

-   Use  `express.json()`  to parse JSON bodies.
    
-   Add logging middleware to track every workflow step.
    
-   Validate required approvals (doctor, pharmacy, insurance, etc.) with custom middleware.
    
-   Chain middleware in the correct order.
    
-   Use a centralized error handler for all errors.
    
-   Test edge cases (missing approvals, incomplete info, etc.).
    
-   Review logs to identify and resolve bottlenecks.
    

## 10. Next Steps & Curiosity Hook

**Next:**  
Learn how to use validation libraries to ensure every discharge packet is complete and correct-no more missing signatures or incomplete instructions!

