import React, { useState } from 'react';
import * as Papa from 'papaparse';
import { useBulkSignupMutation } from '@/store/apiService';
import { Button } from '@/components/ui/button';

const BulkSignup: React.FC = () => {
    const [ bulkSignup ] = useBulkSignupMutation();
    const [jsonData, setJsonData] = useState<any[]>([]);
    console.log('jsonData:', jsonData);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            Papa.parse(file, {
                header: true,
                complete: (results) => {
                    setJsonData(results.data);
                },
                error: (error) => {
                    console.error('Error parsing CSV file:', error);
                },
            });
        }
    };

    const handleBulkSignup = async () => {
        try {
            const response: any = await bulkSignup({ users: jsonData }).unwrap();
            console.log('Bulk signup successful:', response.results);
            const csv = Papa.unparse(response?.results || []);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', 'bulk_signup_result.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Bulk signup failed:', error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-100 p-4">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Bulk Signup</h1>
            <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            className="mb-4 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
            onClick={handleBulkSignup} 
            >
            Sign Up
            </Button>
        </div>
    );
};

export default BulkSignup;
