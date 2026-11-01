"use client";

import { BulkAdd } from "@/components/collection/bulk-add";
import { ImportJson } from "@/components/collection/import-json";
import { SingleAdd } from "@/components/collection/single-add";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AddTabs() {
  return (
    <Tabs defaultValue="single">
      <TabsList>
        <TabsTrigger value="single">Single card</TabsTrigger>
        <TabsTrigger value="bulk">Bulk paste</TabsTrigger>
        <TabsTrigger value="json">Import JSON</TabsTrigger>
      </TabsList>
      <TabsContent value="single" className="pt-4">
        <SingleAdd />
      </TabsContent>
      <TabsContent value="bulk" className="pt-4">
        <BulkAdd />
      </TabsContent>
      <TabsContent value="json" className="pt-4">
        <ImportJson />
      </TabsContent>
    </Tabs>
  );
}
