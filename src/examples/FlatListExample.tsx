import React from "react";
import { FlatList } from "react-native";

export function FlatListExample() {
  return (
    <FlatList data={[1, 2, 3]} renderItem={({ item }) => <div>{item}</div>} />
  );
}
