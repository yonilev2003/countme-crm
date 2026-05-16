import { HelpCircle } from "lucide-react";
import { HelpContent } from "./help-content";
import { HelpChat } from "./help-chat";

export const metadata = {
  title: "עזרה — הנהלת CountMe",
};

export default function HelpPage() {
  return (
    <>
      <div className="mb-8 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <HelpCircle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">
            מרכז העזרה
          </h1>
          <p className="mt-1 text-slate-600">
            מדריך מלא לכל הפיצ׳רים של המערכת + עוזר AI שעונה על שאלות בעברית
          </p>
        </div>
      </div>

      <HelpContent />
      <HelpChat />
    </>
  );
}
