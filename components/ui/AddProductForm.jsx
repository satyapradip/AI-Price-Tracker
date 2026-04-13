"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const AddProductForm = ({user}) => {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;
  }
  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste product URL (Amazon, Flipkart, etc.)"
          className="h-12 text-base"
          required
          disabled={loading}
        />
        <Button
          type="submit"
          className="h-12 px-6 bg-orange-500 hover:bg-orange-600 text-white border-none"
          disabled={loading}
        >
          {loading ? (
          <>
            <Loader2 className="animate-spin w-5 h-5 mr-2" />
            Adding...
          </>
          ) : (
            "Track Price"
            )}
        </Button>
      </div>
    </form>
  );
}

export default AddProductForm;