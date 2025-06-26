export function inviteRedirectTemplate(message: string, redirectUrl: string): string {
  return `
    <html>
      <head>
        <meta http-equiv="refresh" content="5;url=${redirectUrl}" />
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #fff;
            color: #111;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .message-box {
            background: #fffbe7;
            padding: 2rem 3rem;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(255, 193, 7, 0.15);
            text-align: center;
            border: 2px solid #ffc107;
          }
          .message-box h2 {
            color: #111; /* Changed to black */
            margin-bottom: 1rem;
          }
          .redirect {
            margin-top: 1rem;
            color: #111; /* Changed to black */
            font-size: 1rem;
          }
          .redirect a {
            color: #ffa000;
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="message-box">
          <h2>${message}</h2>
          <div class="redirect">
<<<<<<< HEAD
            Redirecting you in 10 seconds...
=======
            Redirecting you in 5 seconds...
>>>>>>> newbranch
            <br>
            <a href="${redirectUrl}">Click here if you are not redirected</a>
          </div>
        </div>
      </body>
    </html>
  `;
}