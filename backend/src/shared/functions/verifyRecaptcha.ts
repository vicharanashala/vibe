import axios from 'axios';

/**
 * Response from Google reCAPTCHA verification API
 */
interface RecaptchaVerificationResponse {
    success: boolean;
    challenge_ts?: string;
    hostname?: string;
    'error-codes'?: string[];
}

/**
 * Verifies a reCAPTCHA token with Google's reCAPTCHA API
 * @param token - The reCAPTCHA token from the frontend
 * @returns Promise that resolves to true if verification succeeds, false otherwise
 * @throws Error if the verification request fails
 */
export async function verifyRecaptcha(token: string): Promise<boolean> {
    if(process.env.IS_RECAPTCHA_ENABLED==="true"){
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;

        if (!secretKey) {
            throw new Error('RECAPTCHA_SECRET_KEY is not configured in environment variables');
        }

        try {
            const response = await axios.post<RecaptchaVerificationResponse>(
                'https://www.google.com/recaptcha/api/siteverify',
                null,
                {
                    params: {
                        secret: secretKey,
                        response: token,
                    },
                }
            );

            if (!response.data.success) {
                console.warn('reCAPTCHA verification failed:', response.data['error-codes']);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error verifying reCAPTCHA:', error);
            throw new Error('Failed to verify reCAPTCHA');
        }
    }
    return true;
}
