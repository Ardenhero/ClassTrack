import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, FileText, ChevronLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Back to Login */}
        <Link 
          href="/login" 
          className="inline-flex items-center text-sm text-gray-500 hover:text-nwu-red mb-8 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Login
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8 overflow-hidden relative text-center">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-nwu-red" />
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-50 rounded-xl">
              <Shield className="w-8 h-8 text-nwu-red" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2 font-serif">Privacy Policy</h1>
          <p className="text-gray-500 text-sm italic">Last Updated: April 1, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-10">
          
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">1. Introduction</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              At **ClassTrack**, we take your privacy seriously. This policy explains how we collect, use, and protect your personal information in accordance with the **Philippine Data Privacy Act of 2012 (RA 10173)** and international standards.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Eye className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">2. Data We Collect</h2>
            </div>
            <div className="space-y-4">
              <p className="text-gray-600">To provide efficient attendance tracking, we process the following data:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                <li><span className="font-semibold text-gray-800">Biometric Template:</span> Mathematical representation of fingerprint data (actual images are not stored).</li>
                <li><span className="font-semibold text-gray-800">Attendance Records:</span> Timestamped logs of when you enter or leave a classroom.</li>
                <li><span className="font-semibold text-gray-800">Academic Info:</span> Your name, student ID, and enrolled courses.</li>
                <li><span className="font-semibold text-gray-800">IoT Logs:</span> Classroom occupancy status used for automation.</li>
              </ul>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-50 rounded-lg">
                <Lock className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">3. Data Protection</h2>
            </div>
            <p className="text-gray-600 leading-relaxed mb-4">
              We implement industry-standard encryption and security protocols to safeguard your records:
            </p>
            <ul className="bg-gray-50 border border-gray-100 rounded-xl p-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                <span>AES-256 encryption at rest for all sensitive database records.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                <span>Secure HTTPS/TLS communication for all data transfers.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                <span>Strict Row-Level Security (RLS) ensuring you only see your own data.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. Your Rights</h2>
            <p className="text-gray-600 leading-relaxed">
              You have the right to access, correct, or request the deletion of your personal data at any time. If you have concerns regarding your data, please contact the **University IT Department** or your course instructor.
            </p>
          </section>

        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2026 ICpEP.SE ClassTrack Project Team. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
