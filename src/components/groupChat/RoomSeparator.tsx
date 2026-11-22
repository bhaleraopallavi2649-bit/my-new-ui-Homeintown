import React from 'react';
import { View } from 'react-native';

// Group rows are flat now (no card box, green theme), so rows are separated by
// a thin hairline inset past the avatar, like a chat list.
const RoomSeparator = () => (
  <View style={{ height: 1, backgroundColor: '#ECE5D8', marginLeft: 82, marginRight: 16 }} />
);

export default RoomSeparator;
