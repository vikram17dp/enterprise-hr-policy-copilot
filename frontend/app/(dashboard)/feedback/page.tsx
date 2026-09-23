"use client";

import { useState } from "react";
import { LifeBuoy, Mail, MessageSquareHeart, Star } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/lib/api/feedback";
import { FEEDBACK_CATEGORIES } from "@/lib/utils/constants";
import { toErrorMessage } from "@/types/api";
import type { FeedbackCategory } from "@/types/chat";
import { cn } from "@/lib/utils/cn";

const selectClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

const ratingLabels = [
  "",
  "Poor",
  "Fair",
  "Good",
  "Very good",
  "Excellent",
];

/**
 * Route: /feedback
 * Star rating + category + comment, submitted to the feedback endpoint.
 */
export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>("answer_accuracy");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const activeStars = hover || rating;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);

    if (rating < 1) {
      toast.error("Please select a rating", {
        description: "Choose 1 to 5 stars to continue.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({ rating, comment: comment.trim(), category });
      toast.success("Thank you for your feedback!");
      setRating(0);
      setHover(0);
      setComment("");
      setCategory("answer_accuracy");
      setTouched(false);
    } catch (err) {
      toast.error("Unable to submit feedback", {
        description: toErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback & Support"
        description="Help us improve the HR Copilot experience."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Feedback form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          {/* Rating */}
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900">
              Rate your experience
            </legend>
            <p className="mt-1 text-sm text-slate-500">
              How satisfied are you with the answers you received?
            </p>

            <div className="mt-3 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value > 1 ? "s" : ""}`}
                  aria-pressed={rating === value}
                  onMouseEnter={() => setHover(value)}
                  onMouseLeave={() => setHover(0)}
                  onFocus={() => setHover(value)}
                  onBlur={() => setHover(0)}
                  onClick={() => {
                    setRating(value);
                    setTouched(true);
                  }}
                  className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                >
                  <Star
                    className={cn(
                      "size-7 transition-colors",
                      value <= activeStars
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-slate-300"
                    )}
                    aria-hidden
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-medium text-slate-600">
                {activeStars > 0 ? ratingLabels[activeStars] : ""}
              </span>
            </div>

            {touched && rating < 1 ? (
              <p className="mt-2 text-xs font-medium text-red-600">
                Please select a rating before submitting.
              </p>
            ) : null}
          </fieldset>

          {/* Category */}
          <div className="mt-6">
            <label
              htmlFor="feedback-category"
              className="text-sm font-semibold text-slate-900"
            >
              Feedback category
            </label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              className={cn(selectClass, "mt-2")}
            >
              {FEEDBACK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Comment */}
          <div className="mt-6">
            <label
              htmlFor="feedback-comment"
              className="text-sm font-semibold text-slate-900"
            >
              Your feedback
            </label>
            <Textarea
              id="feedback-comment"
              rows={5}
              value={comment}
              disabled={submitting}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what worked well or what could be improved..."
              className="mt-2 resize-none rounded-lg border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/15"
            />
            <p className="mt-1.5 text-right text-xs text-slate-400">
              {comment.length}/1000
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit feedback"}
            </Button>
            {submitting ? (
              <span className="text-sm text-slate-400">Sending...</span>
            ) : null}
          </div>
        </form>

        {/* Support panel */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <LifeBuoy className="size-5" aria-hidden />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-900">
              Need help with something else?
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              Our HR support team is available to help with policy questions,
              account issues, and escalations.
            </p>

            <div className="mt-4 space-y-2.5">
              <a
                href="mailto:hr-support@company.com"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700"
              >
                <Mail className="size-4 text-slate-400" aria-hidden />
                hr-support@company.com
              </a>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
                <MessageSquareHeart
                  className="size-4 text-slate-400"
                  aria-hidden
                />
                Mon–Fri, 9:00–18:00
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
            <p className="text-sm leading-6 text-slate-500">
              Feedback is used to improve answer accuracy and policy coverage
              across the HR Copilot.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
