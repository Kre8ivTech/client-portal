"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Clock, Sparkles } from "lucide-react";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

interface ClientServiceCardProps {
  service: Service;
  onRequestService?: (serviceId: string) => void;
}

export function ClientServiceCard({ service, onRequestService }: ClientServiceCardProps) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequest = async () => {
    if (!onRequestService) return;

    setIsRequesting(true);
    try {
      await onRequestService(service.id);
    } finally {
      setIsRequesting(false);
    }
  };

  const formatRate = (rate: number | null) => {
    if (!rate) return "Contact for quote";
    return `$${(rate / 100).toFixed(2)}`;
  };

  const getRateTypeLabel = (type: string | null) => {
    if (!type) return "";
    const labels: Record<string, string> = {
      hourly: "per hour",
      fixed: "fixed price",
      tiered: "tiered pricing",
      custom: "custom quote",
    };
    return labels[type] || type;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      custom_code: "bg-blue-100 text-blue-700 border-blue-200",
      custom_software: "bg-purple-100 text-purple-700 border-purple-200",
      custom_plugin: "bg-green-100 text-green-700 border-green-200",
      maintenance: "bg-orange-100 text-orange-700 border-orange-200",
      support: "bg-pink-100 text-pink-700 border-pink-200",
      consulting: "bg-indigo-100 text-indigo-700 border-indigo-200",
      other: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return colors[category || "other"] || colors.other;
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return "Other";
    return category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h3 className="font-bold text-lg">{service.name}</h3>
              {/* Global badge - only show if is_global column exists and is true */}
              {"is_global" in service && service.is_global && (
                <Badge
                  variant="outline"
                  className="bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-purple-200 text-xs"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Global
                </Badge>
              )}
            </div>
            {service.category && (
              <Badge variant="outline" className={`mt-2 text-xs ${getCategoryColor(service.category)}`}>
                {getCategoryLabel(service.category)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <p className="text-sm text-slate-600 line-clamp-3">{service.description || "No description available"}</p>
      </CardContent>

      <CardFooter className="border-t pt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-slate-400" />
              <span className="font-semibold">{formatRate(service.base_rate)}</span>
              <span className="text-slate-400 text-xs">{getRateTypeLabel(service.rate_type)}</span>
            </div>

            {service.estimated_hours && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <Clock className="h-4 w-4" />
                <span className="text-xs">{service.estimated_hours}h</span>
              </div>
            )}
          </div>
        </div>

        <Button onClick={handleRequest} disabled={isRequesting} className="w-full" size="sm">
          {isRequesting ? "Requesting..." : "Request Service"}
        </Button>
      </CardFooter>
    </Card>
  );
}
