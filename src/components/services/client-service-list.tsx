"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClientServiceCard } from "./client-service-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Package } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

interface ClientServiceListProps {
  initialServices: Service[];
}

const CATEGORIES = [
  { value: "all", label: "All Services" },
  { value: "custom_code", label: "Custom Code" },
  { value: "custom_software", label: "Custom Software" },
  { value: "custom_plugin", label: "Custom Plugin" },
  { value: "maintenance", label: "Maintenance" },
  { value: "support", label: "Support" },
  { value: "consulting", label: "Consulting" },
];

export function ClientServiceList({ initialServices }: ClientServiceListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { toast } = useToast();

  const { data: services, isLoading } = useQuery({
    queryKey: ["services", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }

      const response = await fetch(`/api/services?${params}`);
      if (!response.ok) throw new Error("Failed to fetch services");
      const result = await response.json();
      return result.data as Service[];
    },
    initialData: initialServices,
  });

  const handleRequestService = async (serviceId: string) => {
    try {
      const response = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          priority: "medium",
          details: {},
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create service request");
      }

      toast({
        title: "Service Requested",
        description: "Your service request has been submitted and is pending approval.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request service. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Filter services by search term
  const filteredServices = services?.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Service Grid */}
      {filteredServices && filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <ClientServiceCard key={service.id} service={service} onRequestService={handleRequestService} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No services available</p>
          {searchTerm && <p className="text-sm text-slate-400 mt-1">Try adjusting your search terms</p>}
          {!searchTerm && selectedCategory === "all" && (
            <p className="text-sm text-slate-400 mt-1">Check back later for available services</p>
          )}
        </div>
      )}
    </div>
  );
}
